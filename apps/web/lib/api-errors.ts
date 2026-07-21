import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSession, TenantError, type TenantContext } from "@/lib/tenant";
import { PlatformAdminError } from "@/lib/platform";
import { PlanLimitError } from "@/lib/plan-limits";

/**
 * Error con status HTTP explícito para flujos de API. El mensaje es seguro de
 * mostrar al cliente (no contiene detalles internos).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Mapea cualquier excepción de un route handler a una respuesta JSON.
 * Los errores conocidos conservan mensaje y status; los inesperados se registran
 * en el servidor y devuelven un mensaje neutro — NO se filtran detalles internos
 * (mensajes de Prisma, stack traces, errores de proveedores) al cliente.
 *
 * Uso: `try { ... } catch (e) { return apiError(e); }`
 */
export function apiError(e: unknown): NextResponse {
  if (e instanceof TenantError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof PlatformAdminError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof PlanLimitError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.flatten() }, { status: 400 });
  }
  console.error("[api] error no manejado:", e);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

type Role = TenantContext["role"];
const MANAGER_ROLES: readonly Role[] = ["OWNER", "ADMIN"];

/**
 * Exige una sesión viva cuyo rol esté entre los permitidos. Lanza `TenantError`
 * si no hay contexto de tenant o la sesión fue revocada, y `ApiError(403)` si el
 * rol no alcanza. Devuelve el ctx.
 *
 * Es async porque el rol se contrasta con la BD (`requireSession`), no con el
 * JWT: el token dura 7 días y conserva el rol que tenía al firmarse.
 */
export async function requireRole(roles: readonly Role[]): Promise<TenantContext> {
  const ctx = await requireSession();
  if (!roles.includes(ctx.role)) {
    throw new ApiError(403, "No tienes permiso para esta acción");
  }
  return ctx;
}

/** Atajo para acciones de gestión (dueño o administrador). */
export function requireManager(): Promise<TenantContext> {
  return requireRole(MANAGER_ROLES);
}
