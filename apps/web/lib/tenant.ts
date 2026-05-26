import { headers } from "next/headers";
import { prisma } from "@navaxa/db";

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
  };
}

/**
 * Modelos sin columna tenantId directa (heredan vía relación o son globales).
 * No deben recibir el filtro automático.
 */
const SKIP_TENANT_FILTER = new Set([
  "Session",
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
  const { tenantId } = getTenantContext();

  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
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
