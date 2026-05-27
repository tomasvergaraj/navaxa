import { NextResponse } from "next/server";
import { prisma, Role } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { teamUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const PRIVILEGED = new Set<Role>([Role.OWNER, Role.ADMIN]);

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  try {
    const ctx = requireManager();
    if (params.userId === ctx.userId) {
      return NextResponse.json({ error: "No puedes modificar tu propia cuenta" }, { status: 400 });
    }

    const parsed = teamUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { role, active } = parsed.data;

    const db = scopedDb();
    const target = await db.user.findFirst({
      where: { id: params.userId },
      select: { id: true, role: true, active: true, barber: { select: { id: true } } },
    });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Solo un OWNER puede tocar a OWNER/ADMIN o asignar esos roles (evita escalada por ADMIN).
    const touchesPrivileged = PRIVILEGED.has(target.role) || (role && PRIVILEGED.has(role as Role));
    if (touchesPrivileged && ctx.role !== "OWNER") {
      return NextResponse.json({ error: "Solo el dueño puede gestionar administradores" }, { status: 403 });
    }

    // No dejar la barbería sin OWNER activo.
    const losingOwner =
      target.role === Role.OWNER && ((role && role !== "OWNER") || active === false);
    if (losingOwner) {
      const owners = await db.user.count({ where: { role: Role.OWNER, active: true } });
      if (owners <= 1) {
        return NextResponse.json(
          { error: "Debe quedar al menos un dueño activo" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { ...(role ? { role: role as Role } : {}), ...(active !== undefined ? { active } : {}) },
      });
      // Si el miembro es barbero, sincroniza su disponibilidad con el estado de la cuenta.
      if (active !== undefined && target.barber) {
        await tx.barber.update({ where: { id: target.barber.id }, data: { active } });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
