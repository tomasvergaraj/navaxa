import { prisma, Prisma } from "@navaxa/db";
import { clientIp } from "@/lib/rate-limit";
import type { PlatformActor } from "@/lib/platform";

/**
 * Rastro de auditoría del panel de plataforma.
 *
 * Las acciones de /admin son las únicas que cruzan tenants (suspender una
 * barbería, cambiarle el plan, tocarle la suscripción) y no dejan huella en
 * ningún otro lado: sin esto, un cambio hecho desde una cuenta de operador
 * comprometida es indistinguible de uno legítimo. Ver `AdminAuditLog`.
 */
export async function logAdminAction(input: {
  actor: PlatformActor;
  action: string;
  targetType: string;
  targetId: string;
  /** Solo los campos tocados, no la fila entera: el log no es un backup. */
  before?: unknown;
  after?: unknown;
  req?: Request;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorEmail: input.actor.email,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: toJson(input.before),
        after: toJson(input.after),
        ip: input.req ? clientIp(input.req) : null,
        userAgent: input.req?.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (e) {
    // El log no puede tumbar la operación que ya se aplicó: preferimos un cambio
    // sin registrar a un 500 sobre una escritura que sí ocurrió.
    console.error("[audit] no se pudo registrar la acción", input.action, e);
  }
}

function toJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (v === undefined || v === null) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}
