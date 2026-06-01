import { redirect } from "next/navigation";
import { prisma } from "@navaxa/db";
import { getTenantContext, type TenantContext } from "@/lib/tenant";

export type Role = TenantContext["role"];

/** OWNER y ADMIN son los roles de gestión; BARBER/STAFF ven solo lo suyo. */
export function isManagerRole(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Guarda de página (server component): redirige a /dashboard si el usuario no es
 * OWNER/ADMIN. Para páginas de gestión (reportes, comisiones, equipo, etc.) que
 * no deben ser visibles para barberos. Devuelve el ctx para conveniencia.
 */
export function requireManagerPage(): TenantContext {
  const ctx = getTenantContext();
  if (!isManagerRole(ctx.role)) redirect("/dashboard");
  return ctx;
}

/** barberId del usuario actual, o null si no tiene registro de barbero (p. ej. STAFF). */
export async function currentBarberId(userId: string): Promise<string | null> {
  // barbers.userId es UNIQUE → findFirst por userId es seguro sin filtro de tenant.
  const b = await prisma.barber.findFirst({ where: { userId }, select: { id: true } });
  return b?.id ?? null;
}

/**
 * Ámbito del que mira: rol + si es gestión + su barberId (solo si NO es gestión).
 * Los handlers usan esto para forzar "solo lo suyo" a barberos/staff sin tener
 * que reimplementar la lógica de rol en cada ruta.
 */
export async function viewerScope(): Promise<{
  ctx: TenantContext;
  isManager: boolean;
  barberId: string | null;
}> {
  const ctx = getTenantContext();
  const isManager = isManagerRole(ctx.role);
  const barberId = isManager ? null : await currentBarberId(ctx.userId);
  return { ctx, isManager, barberId };
}
