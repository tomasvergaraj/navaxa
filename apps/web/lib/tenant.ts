import { headers } from "next/headers";
import { prisma } from "@navaxa/db";
import { getSessionState, isSessionRevoked } from "@/lib/session-revocation";

export class TenantError extends Error {
  status = 401;
  constructor(message = "Contexto de tenant ausente") {
    super(message);
  }
}

export type TenantContext = {
  tenantId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "BARBER" | "STAFF";
  /** Instante de emisión del JWT (ms epoch); 0 en tokens previos al claim. */
  authAt: number;
};

export function getTenantContext(): TenantContext {
  const h = headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  const role = h.get("x-user-role");
  if (!tenantId || !userId) {
    throw new TenantError();
  }
  return {
    tenantId,
    userId,
    role: (role ?? "STAFF") as TenantContext["role"],
    authAt: Number(h.get("x-auth-at") ?? 0),
  };
}

/**
 * Verifica contra BD (cacheado 60s) que la sesión del request siga viva: cuenta
 * activa, tenant activo y token posterior al corte de revocación. Devuelve el
 * estado fresco del usuario.
 *
 * Hace falta porque el middleware solo decodifica el JWT — corre en Edge y no
 * alcanza Postgres —, así que sin esto un usuario desactivado o al que le
 * cambiaron la clave seguiría entrando hasta que expire el token (7 días).
 */
async function loadValidState(ctx: TenantContext) {
  const state = await getSessionState(ctx.userId);
  if (isSessionRevoked(state, ctx.authAt)) {
    throw new TenantError("Sesión expirada o revocada");
  }
  return state!;
}

export async function assertSessionValid(ctx: TenantContext): Promise<void> {
  await loadValidState(ctx);
}

/**
 * Contexto del request con el **rol leído de la BD**, no el del JWT.
 *
 * El rol del token queda obsoleto en cuanto se lo cambian y el JWT dura 7 días:
 * sin esto, a un OWNER degradado a BARBER le seguían pasando los guards de
 * gestión. Es la puerta que usan `requireRole`/`requireManager`.
 */
export async function requireSession(): Promise<TenantContext> {
  const ctx = getTenantContext();
  const state = await loadValidState(ctx);
  return { ...ctx, role: state.role as TenantContext["role"] };
}

/**
 * Modelos sin columna tenantId directa (heredan vía relación o son globales).
 * No deben recibir el filtro automático.
 */
const SKIP_TENANT_FILTER = new Set([
  "Session",
  "AdminAuditLog", // es de plataforma: cruza tenants por definición

  "BarberSchedule",
  "BarberTimeOff",
  "AppointmentService",
  "ClientPreference",
]);

/**
 * Operaciones de Prisma que aceptan `where` o `data`.
 */
const SCOPED_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
  "create",
  "createMany",
  "update",
  "delete",
  "upsert",
]);

/**
 * Devuelve un Prisma client que inyecta automáticamente tenantId en cada query.
 * Imposibilita que un route handler olvide filtrar por tenant.
 */
export function scopedDb() {
  const ctx = getTenantContext();
  const { tenantId } = ctx;

  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Puerta de revocación: ningún dato del tenant se lee ni escribe con
          // una sesión muerta. Va acá y no en el middleware porque este cliente
          // es el único punto por el que pasan todas las queries del request.
          await assertSessionValid(ctx);

          if (!SCOPED_OPS.has(operation) || SKIP_TENANT_FILTER.has(model)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          if (operation === "create") {
            a.data = { ...(a.data as object), tenantId };
          } else if (operation === "createMany") {
            const data = a.data as object | object[];
            a.data = (Array.isArray(data) ? data : [data]).map((d) => ({
              ...d,
              tenantId,
            }));
          } else if (operation === "upsert") {
            const where = (a.where ?? {}) as Record<string, unknown>;
            a.where = { ...where, tenantId };
            a.create = { ...((a.create as object) ?? {}), tenantId };
          } else {
            const where = (a.where ?? {}) as Record<string, unknown>;
            a.where = { ...where, tenantId };
          }

          return query(args);
        },
      },
    },
  });
}

/** Para uso en jobs/cron donde no hay request — recibe tenantId explícito. */
export function tenantDb(tenantId: string) {
  return prisma.$extends({
    name: "tenant-scope-explicit",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SCOPED_OPS.has(operation) || SKIP_TENANT_FILTER.has(model)) {
            return query(args);
          }
          const a = args as Record<string, unknown>;
          if (operation === "create" || operation === "createMany") {
            const data = a.data as object | object[];
            a.data = Array.isArray(data)
              ? data.map((d) => ({ ...d, tenantId }))
              : { ...data, tenantId };
          } else {
            const where = (a.where ?? {}) as Record<string, unknown>;
            a.where = { ...where, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
