/**
 * Cloudflare Turnstile — captcha para los formularios públicos (reserva online).
 *
 * Se activa solo si están las DOS llaves (`TURNSTILE_SITE_KEY` pública y
 * `TURNSTILE_SECRET_KEY` privada). Sin ellas todo queda en no-op: el widget no
 * se renderiza y la verificación del servidor pasa de largo, así el flujo de
 * reserva sigue funcionando en dev y en instalaciones sin captcha configurado.
 *
 * Las llaves se leen en RUNTIME (no son NEXT_PUBLIC_*): la site key viaja al
 * cliente como prop desde el Server Component, así cambiarla solo pide
 * `docker compose up -d web`, no un rebuild de la imagen.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Site key pública, o null si no hay captcha configurado. */
export function turnstileSiteKey(): string | null {
  const site = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  // Solo exponemos la site key si además hay secret: un widget cuyo token nadie
  // valida es peor que nada (fricción sin protección).
  return site && secret ? site : null;
}

/**
 * Valida el token del widget contra Cloudflare.
 *
 * - Sin llaves configuradas → `true` (no-op).
 * - Con llaves y token ausente/inválido/expirado → `false`.
 * - Si la llamada a Cloudflare falla (red, timeout) → `false` (fail-closed).
 *   No es un agujero de disponibilidad real: si Cloudflare no responde, el
 *   widget del cliente tampoco emite tokens.
 *
 * El token es de un solo uso y vive ~5 min: tras un submit fallido el cliente
 * debe pedir uno nuevo (el widget se resetea).
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !process.env.TURNSTILE_SITE_KEY?.trim()) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("[turnstile] token rechazado", data["error-codes"]);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[turnstile] verificación falló", (e as Error).message);
    return false;
  }
}
