import crypto from "node:crypto";

/**
 * Tokens firmados HMAC, stateless (sin tabla de sesión). Centraliza la
 * maquinaria que antes estaba duplicada en public-booking / payments / billing
 * / reviews. Cada flujo usa un `scope` distinto para que un token de uno NO
 * sirva en otro, y todos llevan expiración embebida.
 *
 * Formato: b64url("payload:exp") "." b64url(hmac("scope:payload:exp"))
 *   - `exp` es epoch en segundos; 0 = sin expiración.
 *   - La verificación re-firma el cuerpo canónico y compara el token COMPLETO
 *     en tiempo constante, así un cuerpo no canónico falla.
 */

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(scope: string, body: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(`${scope}:${body}`).digest();
  return `${b64url(body)}.${b64url(sig)}`;
}

/** Firma un token para `scope`. `ttlSec` opcional (omitido o ≤0 = sin expiración). */
export function signToken(scope: string, payload: string, ttlSec?: number): string {
  const exp = ttlSec && ttlSec > 0 ? Math.floor(Date.now() / 1000) + ttlSec : 0;
  return sign(scope, `${payload}:${exp}`);
}

/**
 * Verifica un token para `scope`. Devuelve el payload original (sin el `exp`)
 * o null si la firma no coincide, el scope no corresponde o el token expiró.
 */
export function verifyToken(scope: string, token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  let body: string;
  try {
    body = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(scope, body);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // exp es el último segmento (es un número, nunca lleva ":"); el resto es el payload.
  const idx = body.lastIndexOf(":");
  if (idx < 0) return null;
  const payload = body.slice(0, idx);
  const exp = Number(body.slice(idx + 1));
  if (!Number.isFinite(exp)) return null;
  if (exp !== 0 && Date.now() / 1000 > exp) return null;

  return payload;
}

/** TTLs por flujo (segundos). Acotan los enlaces sin romper el uso legítimo. */
export const TOKEN_TTL = {
  /** Gestión de reserva: cubre reservas hechas con bastante anticipación. */
  manage: 180 * 24 * 60 * 60,
  /** Invitación a reseñar: las reseñas se dejan poco después de la cita. */
  review: 90 * 24 * 60 * 60,
  /** Rating de foto de corte: ventana corta, lo abre el cliente en el momento. */
  haircutRate: 30 * 24 * 60 * 60,
  /** Checkout de abono: el Payment.expiresAt (20 min) es el guard real. */
  pay: 24 * 60 * 60,
  /** Checkout de plan: el dueño lo usa de inmediato (además atado a sesión). */
  bill: 24 * 60 * 60,
  /**
   * Link/QR para que el cliente pague el saldo de su cita. Holgado respecto del
   * `AppointmentCharge.expiresAt` (el guard real), para que un enlace vencido
   * muestre «expiró» en vez de «enlace inválido».
   */
  apptCharge: 7 * 24 * 60 * 60,
  /**
   * Compra pública de giftcard. Largo a propósito: el comprador vuelve a este
   * enlace para releer el código que compró. El guard del cobro es
   * GiftCardOrder.expiresAt, no este TTL.
   */
  giftOrder: 180 * 24 * 60 * 60,
} as const;
