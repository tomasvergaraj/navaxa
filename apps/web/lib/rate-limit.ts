/**
 * Rate-limit simple en memoria (ventana fija por clave).
 * Suficiente para un solo proceso (VPS/dev). En despliegues serverless
 * multi-instancia conviene migrar a un store compartido (Redis/Upstash).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Purga oportunista: el Map nunca borra buckets vencidos por sí solo (fuga lenta
// de memoria con muchas IPs distintas). Cada N llamadas barremos los expirados.
let callsSinceSweep = 0;
const SWEEP_EVERY = 500;

function maybeSweep(now: number): void {
  if (++callsSinceSweep < SWEEP_EVERY) return;
  callsSinceSweep = 0;
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  maybeSweep(now);
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * IP real del cliente. En prod estamos detrás de Cloudflare → nginx, y nginx
 * appendea su `$remote_addr` (la IP del edge de Cloudflare) al final de
 * X-Forwarded-For, así que el ÚLTIMO valor de XFF NO es el cliente sino CF.
 * Cloudflare pone la IP real del visitante en `CF-Connecting-IP` y la
 * sobreescribe (no la puede falsear el cliente mientras el tráfico pase por CF),
 * por eso es la fuente confiable. Caemos a XFF/x-real-ip solo si no hay CF
 * (dev local / acceso directo al origen).
 *
 * El origen está cerrado a los rangos de CF en nginx (403 a cualquier otra IP) y
 * nginx reescribe CF-Connecting-IP con la IP que validó, así que el header no se
 * puede inventar pegándole directo al VPS. Ver DEPLOY.md § "Origen cerrado a
 * Cloudflare"; si ese candado se saca, este rate-limit se evade.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
