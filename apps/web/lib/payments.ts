import { DepositType, prisma } from "@navaxa/db";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";
import { createWebpayTransaction } from "@/lib/webpay";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Minutos que el cliente tiene para pagar antes de que se libere la hora. */
export const PAYMENT_TTL_MIN = 20;

/**
 * Calcula el abono (en CLP) que debe pagar el cliente al reservar.
 * Devuelve 0 si no corresponde cobrar. Nunca supera el total.
 */
export function computeDeposit(
  total: number,
  depositType: DepositType,
  depositValue: number,
): number {
  if (total <= 0) return 0;
  switch (depositType) {
    case "FIXED":
      return Math.min(Math.max(0, Math.round(depositValue)), total);
    case "PERCENT": {
      const pct = Math.min(100, Math.max(0, depositValue));
      return Math.min(Math.round((total * pct) / 100), total);
    }
    default:
      return 0;
  }
}

// ---- Token de pago (stateless, HMAC) ----
// El Payment.expiresAt (PAYMENT_TTL_MIN) es el guard real del checkout; el TTL
// del token solo acota el enlace.
export function signPaymentToken(paymentId: string): string {
  return signToken("pay", paymentId, TOKEN_TTL.pay);
}

export function verifyPaymentToken(token: string): string | null {
  return verifyToken("pay", token);
}

// ---- Abstracción de pasarela ----

export interface CheckoutInput {
  paymentId: string;
  token: string; // token de pago firmado (para construir URLs propias)
  amount: number;
  currency: string;
  description: string;
}

export interface CheckoutResult {
  providerRef: string;
  checkoutUrl: string; // a dónde se envía al cliente para pagar
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
}

/**
 * Proveedor mock para dev: "hospeda" el checkout en nuestra propia página
 * /pagar/[token], que simula el pago. Una pasarela real (Flow, Webpay, Mercado
 * Pago) devolvería aquí su propia URL de pago y notificaría por webhook.
 */
const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout({ paymentId, token }) {
    return {
      providerRef: `mock_${paymentId}`,
      checkoutUrl: `${APP_URL}/pagar/${token}`,
    };
  },
};

/**
 * Webpay Plus (Transbank). createCheckout llama a Transbank y guarda el
 * `token_ws` retornado en Payment.providerRef. El cliente sigue viendo
 * `/pagar/[token]` (resumen) y al apretar "Pagar" su browser hace POST al
 * formulario de Webpay con ese token (ver page.tsx). El commit ocurre cuando
 * Transbank redirige al return_url tras el pago.
 */
const webpayProvider: PaymentProvider = {
  name: "webpay",
  async createCheckout({ paymentId, token, amount }) {
    const buyOrder = `nx_${paymentId}`.slice(0, 26);
    const sessionId = paymentId.slice(0, 61);
    const created = await createWebpayTransaction({
      buy_order: buyOrder,
      session_id: sessionId,
      amount,
      return_url: `${APP_URL}/api/public/webpay/return`,
    });
    return {
      providerRef: created.token,
      checkoutUrl: `${APP_URL}/pagar/${token}`,
    };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const p = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  if (p === "webpay") return webpayProvider;
  // Fail-closed: en producción no permitimos caer silenciosamente al proveedor
  // mock (cobros gratis). Si falta/está mal seteado PAYMENT_PROVIDER, es un error
  // de despliegue y preferimos romper el checkout antes que regalar el servicio.
  if (process.env.NODE_ENV === "production" && p !== "mock") {
    throw new Error(`PAYMENT_PROVIDER inválido en producción: "${p}"`);
  }
  return mockProvider;
}

/**
 * Carga un pago a partir de su token, con todo lo necesario para mostrar el
 * checkout y para notificar al confirmar. Devuelve null si el token es inválido
 * o el pago no existe.
 */
export async function loadPaymentByToken(token: string) {
  const paymentId = verifyPaymentToken(token);
  if (!paymentId) return null;
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, plan: true, address: true, timezone: true, currency: true },
      },
      appointment: {
        include: {
          barber: { include: { user: { select: { name: true } } } },
          client: { select: { firstName: true, phone: true, email: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      },
    },
  });
}

export type PaymentWithContext = NonNullable<Awaited<ReturnType<typeof loadPaymentByToken>>>;

/**
 * Marca un pago PENDING como FAILED y cancela la cita que lo esperaba, en la
 * misma transacción. Si el abono no se concreta, la reserva NO debe quedar
 * agendada: la cita se cancela y el slot se libera.
 *
 * Idempotente y a prueba de carreras: solo actúa si el pago sigue PENDING, y
 * solo cancela la cita si sigue PENDING_PAYMENT (no toca una cita que el
 * dueño haya confirmado a mano mientras tanto).
 */
export async function failPaymentAndReleaseSlot(paymentId: string, appointmentId: string) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "FAILED" },
    });
    if (claimed.count === 0) return;
    await tx.appointment.updateMany({
      where: { id: appointmentId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Abono no pagado" },
    });
  });
}
