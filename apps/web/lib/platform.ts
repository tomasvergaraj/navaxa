import { getTenantContext } from "@/lib/tenant";
import { getSessionState, isTokenStale } from "@/lib/session-revocation";

export class PlatformAdminError extends Error {
  status = 403;
  constructor(message = "Requiere permisos de plataforma") {
    super(message);
  }
}

/** Quién ejecutó una acción de plataforma; se persiste en el rastro de auditoría. */
export type PlatformActor = {
  userId: string;
  email: string;
};

/**
 * Gatea operaciones de super admin (panel /admin) **contra la BD**, no contra el
 * JWT.
 *
 * El header `x-platform-admin` lo pone el middleware desde el token, y el token
 * dura 7 días: solo se refresca cuando algo lee la sesión (`auth()`), así que una
 * secuencia de llamadas a la API puede seguir presentándose como operador de
 * plataforma después de que se le quitó el flag. Es la misma staleness que M2
 * arregló para el rol de tenant; acá el privilegio es mayor (cross-tenant).
 *
 * `getSessionState` está cacheado 60s y ya lo consultan `scopedDb`/`requireSession`,
 * así que en la práctica no agrega queries.
 *
 * Devuelve el actor para poder registrarlo en `admin_audit_logs`.
 * Lanza PlatformAdminError si el usuario no es operador de la plataforma.
 */
export async function requireSuperAdmin(): Promise<PlatformActor> {
  const ctx = getTenantContext();
  const state = await getSessionState(ctx.userId);
  // Sesión muerta (cuenta desactivada, clave cambiada) también cae acá: /admin no
  // pasa por scopedDb, que es donde vive la puerta de revocación del resto.
  // No se mira `tenantActive` a propósito: el operador trabaja fuera del scope de
  // tenant, y suspender su propia barbería desde el panel lo dejaría sin panel.
  if (!state || !state.active || isTokenStale(state, ctx.authAt)) {
    throw new PlatformAdminError();
  }
  if (!state.platformAdmin) throw new PlatformAdminError();
  return { userId: ctx.userId, email: state.email };
}
