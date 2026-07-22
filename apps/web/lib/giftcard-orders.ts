import { addMonths } from "date-fns";
import { prisma } from "@navaxa/db";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";
import { createWebpayTransaction } from "@/lib/webpay";
import { issueGiftCardTx } from "@/lib/giftcards";
import { sendNotification } from "@/lib/notifications";

/**
 * Compra pública de giftcard: el visitante de la vitrina paga por la pasarela y
 * la giftcard se EMITE recién cuando el cobro se confirma.
 *
 * Por qué un modelo aparte de `Payment`: ese cuelga de una cita
 * (`appointmentId @unique`) y acá no hay cita. Y por qué no emitir la giftcard
 * antes de cobrar: sería saldo canjeable regalado ante cualquier abandono del
 * checkout.
 *
 * OJO (regla contable): al confirmar se crea además una `Sale` por el monto
 * total, porque el ingreso se reconoce al EMITIR. Cuando ese saldo se canje
 * después, la venta de caja suma `total - giftCardAmount` y no se cuenta dos
 * veces. Cualquier cambio acá tiene que preservar eso.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Minutos que el comprador tiene para completar el pago antes de que caduque. */
export const GIFTCARD_ORDER_TTL_MIN = 30;

export function signGiftCardOrderToken(orderId: string): string {
  return signToken("gcorder", orderId, TOKEN_TTL.giftOrder);
}

export function verifyGiftCardOrderToken(token: string): string | null {
  return verifyToken("gcorder", token);
}

export async function loadGiftCardOrderByToken(token: string) {
  const orderId = verifyGiftCardOrderToken(token);
  if (!orderId) return null;
  return prisma.giftCardOrder.findUnique({
    where: { id: orderId },
    include: {
      tenant: { select: { id: true, name: true, slug: true, timezone: true, currency: true } },
      giftCard: { select: { code: true, balance: true, expiresAt: true } },
    },
  });
}

export type GiftCardOrderWithContext = NonNullable<
  Awaited<ReturnType<typeof loadGiftCardOrderByToken>>
>;

/** Proveedor activo para la compra de giftcards: el mismo que el de los abonos. */
export function giftCardOrderProvider(): "webpay" | "mock" {
  const p = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  if (p === "webpay") return "webpay";
  // Fail-closed igual que en payments.ts: en producción no caemos al mock en
  // silencio, porque el mock entrega giftcards sin cobrar.
  if (process.env.NODE_ENV === "production" && p !== "mock") {
    throw new Error(`PAYMENT_PROVIDER inválido en producción: "${p}"`);
  }
  return "mock";
}

/**
 * Crea la orden PENDING y, con Webpay, la transacción en Transbank. Devuelve el
 * token propio con el que el comprador vuelve a su checkout.
 */
export async function createGiftCardOrder(input: {
  tenantId: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  expiresInMonths: number;
}): Promise<{ order: { id: string }; token: string }> {
  const provider = giftCardOrderProvider();
  const order = await prisma.giftCardOrder.create({
    data: {
      tenantId: input.tenantId,
      amount: input.amount,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      recipientName: input.recipientName || null,
      recipientEmail: input.recipientEmail || null,
      message: input.message || null,
      expiresInMonths: input.expiresInMonths,
      expiresAt: new Date(Date.now() + GIFTCARD_ORDER_TTL_MIN * 60 * 1000),
      provider,
    },
  });

  const token = signGiftCardOrderToken(order.id);

  if (provider === "webpay") {
    // buy_order tope 26 chars, session_id tope 61 (contrato de Webpay Plus).
    const created = await createWebpayTransaction({
      buy_order: `gc_${order.id}`.slice(0, 26),
      session_id: order.id.slice(0, 61),
      amount: order.amount,
      return_url: `${APP_URL}/api/public/webpay/giftcard-return`,
    });
    await prisma.giftCardOrder.update({
      where: { id: order.id },
      data: { providerRef: created.token },
    });
  }

  return { order: { id: order.id }, token };
}

/**
 * Cierra la orden como pagada: emite la giftcard, registra la venta que
 * reconoce el ingreso y linkea todo, en UNA transacción. Idempotente por el
 * guard `status: PENDING` del updateMany: dos returns concurrentes de Webpay
 * no emiten dos giftcards.
 *
 * Devuelve el código emitido, o null si perdió la carrera (ya estaba cerrada).
 */
export async function confirmGiftCardOrder(orderId: string): Promise<string | null> {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.giftCardOrder.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const order = await tx.giftCardOrder.findUniqueOrThrow({ where: { id: orderId } });

    const card = await issueGiftCardTx(tx, {
      tenantId: order.tenantId,
      amount: order.amount,
      buyerName: order.buyerName,
      recipientName: order.recipientName ?? undefined,
      recipientEmail: order.recipientEmail ?? undefined,
      message: order.message ?? undefined,
      expiresAt: order.expiresInMonths > 0 ? addMonths(new Date(), order.expiresInMonths) : null,
    });

    // La venta que reconoce el ingreso. `giftCardAmount` queda en 0 a propósito:
    // esta venta ES la entrada de plata, no un canje de saldo previo. El link a
    // `giftCardId` deja rastro de qué giftcard originó el ingreso.
    await tx.sale.create({
      data: {
        tenantId: order.tenantId,
        total: order.amount,
        paymentMethod: "CARD",
        giftCardId: card.id,
        note: `Giftcard ${card.code} comprada online por ${order.buyerName}`,
        items: {
          create: [{ name: `Giftcard ${card.code}`, unitPrice: order.amount, qty: 1 }],
        },
      },
    });

    await tx.giftCardOrder.update({
      where: { id: order.id },
      data: { giftCardId: card.id },
    });

    return { card, order };
  });

  if (!result) return null;

  // Email con el código (best-effort: el checkout ya lo muestra en pantalla).
  const to = result.order.recipientEmail || result.order.buyerEmail;
  const tenant = await prisma.tenant.findUnique({
    where: { id: result.order.tenantId },
    select: { name: true },
  });
  void sendNotification({
    tenantId: result.order.tenantId,
    channel: "EMAIL",
    recipient: to,
    templateKey: "giftcard_issued",
    data: {
      recipientName: result.order.recipientName ?? "",
      shopName: tenant?.name ?? "la barbería",
      amount: result.card.initialValue,
      code: result.card.code,
      message: result.order.message ?? "",
    },
  }).catch(() => {});

  return result.card.code;
}

/** Marca la orden como fallida/expirada. No hay nada que liberar: no se emitió giftcard. */
export async function failGiftCardOrder(
  orderId: string,
  status: "FAILED" | "EXPIRED" = "FAILED",
): Promise<void> {
  await prisma.giftCardOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status },
  });
}
