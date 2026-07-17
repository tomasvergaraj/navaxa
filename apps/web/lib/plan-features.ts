import { prisma, type Plan } from "@navaxa/db";
import { ApiError } from "./api-errors";

/**
 * Gates de features por plan (complementa los límites numéricos de
 * lib/plan-limits.ts). Vive aparte para no crear el ciclo
 * api-errors → plan-limits → api-errors.
 */

/** Caja, productos e inventario: desde STARTER (FREE ve upsell). */
export function planHasProducts(plan: Plan): boolean {
  return plan !== "FREE";
}

/** Gift cards: plan PRO+. */
export function planHasGiftCards(plan: Plan): boolean {
  return plan === "PRO" || plan === "ENTERPRISE";
}

/** Personalización visual del storefront (color de marca): plan PRO+. */
export function planHasBranding(plan: Plan): boolean {
  return plan === "PRO" || plan === "ENTERPRISE";
}

export async function assertGiftCardsPlan(tenantId: string): Promise<Plan> {
  const plan = await getTenantPlan(tenantId);
  if (!planHasGiftCards(plan)) {
    throw new ApiError(403, "Las giftcards están disponibles en el plan Pro.");
  }
  return plan;
}

export async function getTenantPlan(tenantId: string): Promise<Plan> {
  // Tenant no lleva columna tenantId → prisma directo, no scopedDb.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new ApiError(404, "Barbería no encontrada");
  return tenant.plan;
}

/** Lanza 403 si el plan del tenant no incluye caja/productos. */
export async function assertProductsPlan(tenantId: string): Promise<Plan> {
  const plan = await getTenantPlan(tenantId);
  if (!planHasProducts(plan)) {
    throw new ApiError(403, "La caja y el control de productos están disponibles desde el plan Starter.");
  }
  return plan;
}
