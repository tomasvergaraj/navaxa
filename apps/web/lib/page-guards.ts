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
 * Ámbito del que mira, en 3 niveles:
 *  - **gestión** (OWNER/ADMIN): `isManager` → ve finanzas/config y toda la operación.
 *  - **recepción** (STAFF): no es gestión ni barbero → ve TODA la agenda/clientes
 *    del local (para agendar/registrar) pero NO finanzas/config (lo bloquea
 *    requireManager*). `ownOnly=false`, `barberId=null`.
 *  - **barbero** (BARBER): `ownOnly=true` → solo su propia agenda/clientes.
 *
 * Así "solo lo suyo" aplica únicamente a BARBER; STAFF no queda con la app vacía.
 */
export async function viewerScope(): Promise<{
  ctx: TenantContext;
  isManager: boolean;
  ownOnly: boolean;
  barberId: string | null;
}> {
  const ctx = getTenantContext();
  const isManager = isManagerRole(ctx.role);
  const ownOnly = ctx.role === "BARBER";
  const barberId = ownOnly ? await currentBarberId(ctx.userId) : null;
  return { ctx, isManager, ownOnly, barberId };
}
