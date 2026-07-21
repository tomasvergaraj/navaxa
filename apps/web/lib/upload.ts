import { ApiError } from "@/lib/api-errors";

/**
 * Rechaza uploads demasiado grandes ANTES de bufferizar el cuerpo con
 * `req.formData()` (que en el App Router materializa todo el multipart en
 * memoria). Sin este guard, un POST de cientos de MB se aloja completo antes de
 * que corra el chequeo de `file.size` → DoS por memoria en la VPS compartida.
 *
 * `Content-Length` es atacante-controlado, así que esto NO reemplaza el backstop
 * real (nginx `client_max_body_size`), pero corta el caso honesto/común barato.
 */
export function guardUploadSize(req: Request, maxBytes: number): void {
  const len = Number(req.headers.get("content-length") ?? 0);
  // +64 KiB de holgura para el framing multipart (boundaries, headers de parte).
  if (Number.isFinite(len) && len > maxBytes + 64 * 1024) {
    throw new ApiError(413, "Archivo demasiado grande");
  }
}
