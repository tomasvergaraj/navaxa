import { prisma, type Plan } from "@navaxa/db";
import { PLANS } from "@navaxa/config";

/** Recursos cuyo uso está acotado por el plan del tenant. */
export type LimitedResource = "barbers" | "clients" | "photos";

const RESOURCE_LABEL: Record<LimitedResource, string> = {
  barbers: "barberos",
  clients: "clientes",
  photos: "fotos",
};

/**
 * Se lanza cuando el tenant alcanzó el tope de su plan para un recurso.
 * Los route handlers la mapean a un 403 con `code` para que la UI la distinga
 * de otros errores y ofrezca subir de plan.
 */
export class PlanLimitError extends Error {
  readonly status = 403;
  readonly code = "PLAN_LIMIT" as const;

  constructor(
    readonly resource: LimitedResource,
    readonly plan: Plan,
    readonly limit: number,
  ) {
    super(
      `Alcanzaste el límite de ${RESOURCE_LABEL[resource]} de tu plan ${PLANS[plan].name} (${limit}). Sube de plan para agregar más.`,
    );
    this.name = "PlanLimitError";
  }
}

function planLimit(plan: Plan, resource: LimitedResource): number {
  return PLANS[plan].limits[resource];
}

/** Uso actual del recurso para el tenant. Cada count usa un índice por tenantId. */
function currentUsage(tenantId: string, resource: LimitedResource): Promise<number> {
  switch (resource) {
    case "barbers":
      return prisma.barber.count({ where: { tenantId, active: true } });
    case "clients":
      return prisma.client.count({ where: { tenantId } });
    case "photos":
      // Solo la galería de cortes acumula imágenes; avatar/logo/portada reemplazan una sola.
      return prisma.haircutRecord.count({ where: { tenantId } });
  }
}

/**
 * Lanza `PlanLimitError` si el tenant ya está en (o sobre) el tope de su plan
 * para el recurso dado. Llamar ANTES de crear el recurso (y antes de subir el
 * archivo, en el caso de fotos, para no gastar storage en algo que se rechaza).
 *
 * Tenant no lleva columna tenantId → se lee con `prisma` directo, no `scopedDb`.
 */
export async function assertWithinPlanLimit(
  tenantId: string,
  resource: LimitedResource,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error("Tenant no encontrado");

  const limit = planLimit(tenant.plan, resource);
  if (!Number.isFinite(limit)) return; // plan ilimitado para este recurso

  const used = await currentUsage(tenantId, resource);
  if (used >= limit) {
    throw new PlanLimitError(resource, tenant.plan, limit);
  }
}
