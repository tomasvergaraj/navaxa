import { redirect } from "next/navigation";
import { prisma } from "@navaxa/db";
import { requireSession, type TenantContext } from "@/lib/tenant";
import { requireSuperAdmin, type PlatformActor } from "@/lib/platform";

export type Role = TenantContext["role"];

/** OWNER y ADMIN son los roles de gestión; BARBER/STAFF ven solo lo suyo. */
export function isManagerRole(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Guarda de página (server component): redirige a /dashboard si el usuario no es
 * OWNER/ADMIN. Para páginas de gestión (reportes, comisiones, equipo, etc.) que
 * no deben ser visibles para barberos. Devuelve el ctx para conveniencia.
 *
 * Async porque el rol lo decide la BD y no el JWT (ver `requireSession`).
 */
export async function requireManagerPage(): Promise<TenantContext> {
  const ctx = await requireSession();
  if (!isManagerRole(ctx.role)) redirect("/dashboard");
  return ctx;
}

/**
 * Guarda de página del panel de plataforma (/admin), decidida por BD.
 *
 * Va en el layout **y** en cada page: en el App Router el layout y la page se
 * renderizan en paralelo, así que el redirect del layout no impide que la page
 * corra sus queries — y las de /admin son cross-tenant.
 */
export async function requireSuperAdminPage(): Promise<PlatformActor> {
  try {
    return await requireSuperAdmin();
  } catch {
    redirect("/dashboard");
  }
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
  const ctx = await requireSession();
  const isManager = isManagerRole(ctx.role);
  const ownOnly = ctx.role === "BARBER";
  const barberId = ownOnly ? await currentBarberId(ctx.userId) : null;
  return { ctx, isManager, ownOnly, barberId };
}

/**
 * Filtro de "cliente propio" para el BARBER: solo los que atendió alguna vez.
 * Misma definición que el listado (api/clients/route.ts) — si no, el listado le
 * muestra 3 clientes pero adivinando el id entraba a la ficha de cualquiera.
 * Gestión (OWNER/ADMIN) y recepción (STAFF) no se filtran.
 *
 * Vive acá y no en la ruta porque lo necesitan la API by-id, la página de la
 * ficha, la galería de fotos y la recomendación con IA: con una copia por
 * archivo, la que se olvide queda como agujero (así se filtraron la página y
 * las fotos hasta 2026-07-22).
 */
export async function ownClientFilter(): Promise<Record<string, unknown>> {
  const { ownOnly, barberId } = await viewerScope();
  return ownOnly ? { appointments: { some: { barberId: barberId ?? "__none__" } } } : {};
}
