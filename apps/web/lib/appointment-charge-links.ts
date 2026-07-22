import { prisma } from "@navaxa/db";
import { ApiError } from "./api-errors";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";
import { createWebpayTransaction } from "@/lib/webpay";
import {
  balanceItemLabel,
  computeAppointmentBalance,
  isChargeableStatus,
} from "@/lib/appointment-balance";

/**
 * Cobro del saldo de una cita por link/QR: el dueño genera el enlace desde la
 * agenda y el cliente paga con Webpay desde su propio teléfono.
 *
 * OJO (bundle Edge): este módulo importa `signed-token`, que trae `node:crypto`.
 * NO puede quedar alcanzable desde `instrumentation.ts` — por eso el job que
 * expira los links vive en `lib/notifications/jobs.ts` con un `updateMany` plano
 * y no llama nada de acá. Mismo motivo que `payment-release.ts`.
 *
 * REGLA CONTABLE: al confirmarse, el cobro crea una `Sale` con
 * `kind: APPOINTMENT_BALANCE` — cobranza, no ingreso nuevo (ese se reconoció con
 * el `totalPrice` de la cita completada).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Vigencia del enlace. Larga a propósito: acá no hay hora que liberar. */
export const APPOINTMENT_CHARGE_TTL_MIN = 24 * 60;

/**
 * Antigüedad a partir de la cual se pide una transacción nueva a Transbank al
 * abrir el checkout. El token de Webpay es efímero y el enlace vive 24 h: crear
 * la transacción al generar el QR (como hace `createGiftCardOrder`, que dura 30
 * min) la dejaría muerta para cuando el cliente lo abra.
 */
const WEBPAY_TX_STALE_MS = 5 * 60 * 1000;

export function signAppointmentChargeToken(chargeId: string): string {
  return signToken("apptcharge", chargeId, TOKEN_TTL.apptCharge);
}

export function verifyAppointmentChargeToken(token: string): string | null {
  return verifyToken("apptcharge", token);
}

export function appointmentChargeUrl(token: string): string {
  return `${APP_URL}/pagar/cita/${token}`;
}

/** Proveedor activo. Fail-closed en producción, igual que en giftcard-orders. */
export function appointmentChargeProvider(): "webpay" | "mock" {
  const p = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  if (p === "webpay") return "webpay";
  if (process.env.NODE_ENV === "production" && p !== "mock") {
    throw new Error(`PAYMENT_PROVIDER inválido en producción: "${p}"`);
  }
  return "mock";
}

export interface ChargeLinkSummary {
  id: string;
  amount: number;
  expiresAt: Date;
  url: string;
  token: string;
}

function summarize(charge: { id: string; amount: number; expiresAt: Date }): ChargeLinkSummary {
  const token = signAppointmentChargeToken(charge.id);
  return { id: charge.id, amount: charge.amount, expiresAt: charge.expiresAt, url: appointmentChargeUrl(token), token };
}

/** Link vigente de una cita (PENDING y sin vencer), o null. */
export async function findPendingChargeLink(
  tenantId: string,
  appointmentId: string,
): Promise<ChargeLinkSummary | null> {
  const charge = await prisma.appointmentCharge.findFirst({
    where: { tenantId, appointmentId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, expiresAt: true },
  });
  return charge ? summarize(charge) : null;
}

/**
 * Emite el enlace de cobro. El monto se valida contra el saldo REAL recalculado
 * en el server; el del cliente es solo una propuesta.
 *
 * Si ya hay un link vigente por el mismo monto lo devuelve tal cual, en vez de
 * emitir un segundo QR por la misma deuda (dos enlaces vivos = riesgo de cobro
 * doble). Si el monto pedido es distinto, el anterior se anula.
 */
export async function createAppointmentChargeLink(input: {
  tenantId: string;
  appointmentId: string;
  amount: number;
}): Promise<ChargeLinkSummary> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ApiError(400, "El monto a cobrar debe ser mayor a cero.");
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, tenantId: input.tenantId },
    select: {
      id: true,
      status: true,
      totalPrice: true,
      payment: { select: { amount: true, status: true } },
      sales: { where: { cancelledAt: null }, select: { total: true } },
    },
  });
  if (!appointment) throw new ApiError(404, "Cita no encontrada.");

  if (!isChargeableStatus(appointment.status)) {
    throw new ApiError(
      409,
      appointment.status === "PENDING_PAYMENT"
        ? "La cita todavía está esperando el abono online."
        : "La cita está cancelada.",
    );
  }

  const { balance } = computeAppointmentBalance({
    totalPrice: appointment.totalPrice,
    payment: appointment.payment,
    sales: appointment.sales,
  });
  if (balance <= 0) throw new ApiError(409, "Esta cita ya está pagada por completo.");
  if (input.amount > balance) {
    throw new ApiError(400, "El monto supera el saldo pendiente de la cita.");
  }

  const existing = await prisma.appointmentCharge.findFirst({
    where: {
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, expiresAt: true },
  });
  if (existing) {
    if (existing.amount === input.amount) return summarize(existing);
    await prisma.appointmentCharge.updateMany({
      where: { id: existing.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  }

  const charge = await prisma.appointmentCharge.create({
    data: {
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      amount: input.amount,
      provider: appointmentChargeProvider(),
      expiresAt: new Date(Date.now() + APPOINTMENT_CHARGE_TTL_MIN * 60 * 1000),
    },
    select: { id: true, amount: true, expiresAt: true },
  });
  return summarize(charge);
}

/** Anula el link vigente (el dueño se arrepintió o cobró en efectivo). */
export async function cancelAppointmentChargeLink(
  tenantId: string,
  appointmentId: string,
): Promise<number> {
  const res = await prisma.appointmentCharge.updateMany({
    where: { tenantId, appointmentId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
  return res.count;
}

export async function loadAppointmentChargeByToken(token: string) {
  const id = verifyAppointmentChargeToken(token);
  if (!id) return null;
  return prisma.appointmentCharge.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true, slug: true, timezone: true } },
      appointment: {
        select: {
          id: true,
          startsAt: true,
          status: true,
          totalPrice: true,
          barber: { select: { user: { select: { name: true } } } },
          services: { select: { service: { select: { name: true } } } },
          // Para revalidar el saldo al abrir el enlace: si el dueño alcanzó a
          // cobrar en el local, el checkout no debe dejar pagar de nuevo.
          payment: { select: { amount: true, status: true } },
          sales: { where: { cancelledAt: null }, select: { total: true } },
        },
      },
    },
  });
}

export type AppointmentChargeWithContext = NonNullable<
  Awaited<ReturnType<typeof loadAppointmentChargeByToken>>
>;

/**
 * Crea (o renueva) la transacción de Webpay del cobro y devuelve el `token_ws`
 * con el que el browser hace POST al formulario de Transbank. Perezoso: solo
 * pide una transacción nueva si no hay o si la última quedó vieja.
 */
export async function refreshWebpayTransaction(charge: {
  id: string;
  amount: number;
  provider: string;
  providerRef: string | null;
  updatedAt: Date;
}): Promise<string | null> {
  if (charge.provider !== "webpay") return null;
  const fresh =
    charge.providerRef && Date.now() - charge.updatedAt.getTime() < WEBPAY_TX_STALE_MS;
  if (fresh) return charge.providerRef;

  // buy_order tope 26 chars, session_id tope 61 (contrato de Webpay Plus).
  const created = await createWebpayTransaction({
    buy_order: `ac_${charge.id}`.slice(0, 26),
    session_id: charge.id.slice(0, 61),
    amount: charge.amount,
    return_url: `${APP_URL}/api/public/webpay/appointment-return`,
  });
  await prisma.appointmentCharge.update({
    where: { id: charge.id },
    data: { providerRef: created.token },
  });
  return created.token;
}

/**
 * Cierra el cobro como pagado y registra la venta, en UNA transacción.
 * Idempotente por el claim `status: PENDING` del updateMany: dos returns
 * concurrentes de Webpay no crean dos ventas.
 *
 * SOBREPAGO: si el dueño alcanzó a cobrar el saldo en efectivo mientras el QR
 * circulaba, el saldo puede ser 0 al llegar acá. La venta se crea IGUAL — la
 * plata ya salió de la tarjeta del cliente y negarla la dejaría fuera de todo
 * registro. Queda anotada como sobrepago; la devolución es manual.
 *
 * Devuelve el id de la venta creada, o null si perdió la carrera.
 */
export async function confirmAppointmentCharge(
  chargeId: string,
  opts: { authorizationCode?: string } = {},
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.appointmentCharge.updateMany({
      where: { id: chargeId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const charge = await tx.appointmentCharge.findUniqueOrThrow({
      where: { id: chargeId },
      select: {
        id: true,
        tenantId: true,
        amount: true,
        appointment: {
          select: {
            id: true,
            clientId: true,
            barberId: true,
            totalPrice: true,
            payment: { select: { amount: true, status: true } },
            sales: { where: { cancelledAt: null }, select: { total: true } },
            services: { select: { service: { select: { name: true } } } },
          },
        },
      },
    });

    const { balance } = computeAppointmentBalance({
      totalPrice: charge.appointment.totalPrice,
      payment: charge.appointment.payment,
      sales: charge.appointment.sales,
    });
    const overpaid = charge.amount > balance;
    if (overpaid) {
      console.warn(
        `[appointment-charge] sobrepago charge=${charge.id} cobrado=${charge.amount} saldo=${balance}`,
      );
    }

    const op = opts.authorizationCode ? ` (op. ${opts.authorizationCode})` : "";
    const note = `Pago online del saldo${op}${overpaid ? " — SOBREPAGO: la cita ya estaba saldada" : ""}`;

    const sale = await tx.sale.create({
      data: {
        tenantId: charge.tenantId,
        appointmentId: charge.appointment.id,
        clientId: charge.appointment.clientId,
        barberId: charge.appointment.barberId,
        total: charge.amount,
        paymentMethod: "CARD",
        kind: "APPOINTMENT_BALANCE",
        note,
        items: {
          create: [
            {
              name: balanceItemLabel(charge.appointment.services.map((s) => s.service.name)),
              unitPrice: charge.amount,
              qty: 1,
            },
          ],
        },
      },
      select: { id: true },
    });

    await tx.appointmentCharge.update({
      where: { id: charge.id },
      data: { saleId: sale.id },
    });

    // Otros links vivos por la misma cita quedan sin objeto si ya no hay saldo.
    if (charge.amount >= balance) {
      await tx.appointmentCharge.updateMany({
        where: { appointmentId: charge.appointment.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    }

    return sale.id;
  });
}

/** Marca el cobro como fallido/expirado. No hay nada que liberar. */
export async function failAppointmentCharge(
  chargeId: string,
  status: "FAILED" | "EXPIRED" = "FAILED",
): Promise<void> {
  await prisma.appointmentCharge.updateMany({
    where: { id: chargeId, status: "PENDING" },
    data: { status },
  });
}
