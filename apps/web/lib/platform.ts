import { headers } from "next/headers";

export class PlatformAdminError extends Error {
  status = 403;
  constructor(message = "Requiere permisos de plataforma") {
    super(message);
  }
}

/**
 * Gatea operaciones de super admin (panel /admin). Lee el header `x-platform-admin`
 * que pone el middleware desde el JWT — el JWT es la fuente de verdad porque
 * `User.platformAdmin` se persiste en BD al login.
 *
 * Lanza PlatformAdminError si el usuario no es operador de la plataforma.
 */
export function requireSuperAdmin(): void {
  const isAdmin = headers().get("x-platform-admin") === "1";
  if (!isAdmin) throw new PlatformAdminError();
}
