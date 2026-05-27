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

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
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
 * IP del cliente detrás del reverse proxy. Caddy AÑADE la IP que observa al FINAL
 * de X-Forwarded-For, por lo que tomamos el ÚLTIMO valor: el primero lo puede
 * falsificar el cliente (enviando su propio XFF) para evadir el rate-limit.
 * Asume un único proxy de confianza (deploy = VPS de instancia única); con más
 * saltos habría que hacer configurable cuántos descartar.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
