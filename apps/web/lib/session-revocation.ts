import { prisma, type Role } from "@navaxa/db";

/**
 * Revocación de sesiones con estrategia JWT.
 *
 * El JWT es stateless: una vez firmado vale hasta expirar (7 días), aunque al
 * usuario se le desactive la cuenta, se le baje el rol o se le cambie la clave.
 * Para poder revocarlo sin montar tabla de sesiones guardamos en el usuario el
 * corte `sessionInvalidBefore`: todo token emitido ANTES de esa marca deja de
 * valer. El token lleva su instante de emisión real en el claim `authAt`
 * (`token.iat` no sirve: Auth.js re-firma el JWT en cada lectura de sesión y el
 * iat se refresca).
 *
 * El chequeo cuesta un findUnique por usuario; se cachea en proceso 60s para no
 * pegarle a la BD en cada request (ver COSTS.md). El precio es que revocar tarda
 * hasta 60s en propagarse, salvo en la instancia que hizo el cambio, que invalida
 * su cache al toque.
 */

export type SessionState = {
  active: boolean;
  email: string;
  role: Role;
  tenantId: string;
  tenantActive: boolean;
  platformAdmin: boolean;
  sessionInvalidBefore: Date | null;
};

const TTL_MS = 60_000;

const cache = new Map<string, { at: number; state: SessionState | null }>();

/** Olvida el estado cacheado de un usuario (tras revocar, cambiar rol, etc.). */
export function invalidateSessionState(userId: string): void {
  cache.delete(userId);
}

/**
 * Estado actual del usuario, cacheado {@link TTL_MS}. `null` si no existe.
 * Se consulta con el prisma crudo a propósito: `scopedDb()` lo llama a él, y
 * además el filtro por tenant no aporta nada buscando por PK.
 */
export async function getSessionState(userId: string): Promise<SessionState | null> {
  const hit = cache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.state;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      email: true,
      role: true,
      tenantId: true,
      platformAdmin: true,
      sessionInvalidBefore: true,
      tenant: { select: { active: true } },
    },
  });

  const state: SessionState | null = user
    ? {
        active: user.active,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantActive: user.tenant.active,
        platformAdmin: user.platformAdmin,
        sessionInvalidBefore: user.sessionInvalidBefore,
      }
    : null;

  // Cachear también el null evita que un userId inexistente (token viejo tras
  // borrar la cuenta) golpee la BD en cada request.
  cache.set(userId, { at: now, state });
  return state;
}

/**
 * ¿Este token sigue siendo válido para este usuario?
 *
 * `authAt` es el instante de emisión (ms epoch); los tokens firmados antes de
 * agregar el claim llegan como 0/NaN. En ese caso solo se revocan si el usuario
 * tiene un corte explícito — así el deploy no desloguea a todo el mundo, pero un
 * reset de clave sí mata las sesiones viejas.
 */
export function isSessionRevoked(state: SessionState | null, authAt: number): boolean {
  if (!state) return true;
  if (!state.active || !state.tenantActive) return true;
  return isTokenStale(state, authAt);
}

/**
 * ¿Este token quedó por detrás del corte de revocación del usuario?
 *
 * Aparte de {@link isSessionRevoked} porque el panel de plataforma necesita este
 * pedazo sin el chequeo de tenant (ver lib/platform.ts).
 */
export function isTokenStale(state: SessionState, authAt: number): boolean {
  if (!state.sessionInvalidBefore) return false;
  const issuedAt = Number.isFinite(authAt) ? authAt : 0;
  // Margen de 1s: el corte se escribe con la hora de la app y el token pudo
  // firmarse en el mismo segundo (p. ej. login inmediatamente tras el cambio).
  return issuedAt < state.sessionInvalidBefore.getTime() - 1000;
}
