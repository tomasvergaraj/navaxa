import crypto from "node:crypto";
import { DepositType, prisma } from "@navaxa/db";

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
// Mismo patrón que el token de gestión, pero con prefijo propio para que un
// token no sirva en el otro flujo. token = b64url(paymentId).b64url(hmac("pay:"+id))

function paymentSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

export function signPaymentToken(paymentId: string): string {
  const sig = crypto.createHmac("sha256", paymentSecret()).update(`pay:${paymentId}`).digest();
  return `${b64url(paymentId)}.${b64url(sig)}`;
}

export function verifyPaymentToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let paymentId: string;
  try {
    paymentId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = signPaymentToken(paymentId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return paymentId;
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

export function getPaymentProvider(): PaymentProvider {
  // Cuando exista una pasarela real, seleccionar por env PAYMENT_PROVIDER.
  return mockProvider;
}

/** URL del checkout mock para un token dado. */
export function buildCheckoutUrl(token: string): string {
  return `${APP_URL}/pagar/${token}`;
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
        select: { id: true, name: true, slug: true, address: true, timezone: true, currency: true },
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
