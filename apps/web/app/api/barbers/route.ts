import { NextResponse } from "next/server";
import { prisma, Role, PasswordTokenPurpose, NotificationChannel } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { assertWithinPlanLimit } from "@/lib/plan-limits";
import { barberCreateSchema } from "@/lib/validators";
import { createPasswordToken, buildSetPasswordUrl } from "@/lib/password-tokens";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = scopedDb();
    const barbers = await db.barber.findMany({
      where: { active: true },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, lastLoginAt: true },
        },
        schedule: true,
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ barbers });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = requireManager();

    const parsed = barberCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await assertWithinPlanLimit(tenantId, "barbers");

    const db = scopedDb();
    const email = parsed.data.email.toLowerCase().trim();

    // Se resuelve el nombre del tenant antes de crear (no depende del usuario nuevo),
    // así un fallo aquí no deja un barbero a medias.
    // Tenant no lleva columna tenantId (su id ES el tenant) → prisma directo, no scopedDb.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    // Se crea sin contraseña: el barbero la define él mismo vía link de invitación.
    const created = await db.user.create({
      data: {
        tenantId,
        email,
        name: parsed.data.name,
        passwordHash: null,
        role: Role.BARBER,
        barber: {
          create: {
            tenantId,
            bio: parsed.data.bio,
            commissionRate: parsed.data.commissionRate,
            specialties: parsed.data.specialties,
            instagram: parsed.data.instagram,
            schedule: {
              create: [1, 2, 3, 4, 5, 6].map((wd) => ({
                weekday: wd,
                startMin: 10 * 60,
                endMin: 20 * 60,
              })),
            },
          },
        },
      },
      include: { barber: true },
    });

    // Token de invitación + email para que defina su clave.
    const token = await createPasswordToken(created.id, PasswordTokenPurpose.INVITE);
    const inviteUrl = buildSetPasswordUrl(token);

    await sendNotification({
      tenantId,
      channel: NotificationChannel.EMAIL,
      recipient: email,
      templateKey: "barber_invite",
      data: {
        firstName: created.name,
        shopName: tenant?.name ?? "tu barbería",
        actionUrl: inviteUrl,
      },
    });

    // inviteUrl se devuelve para que el dueño pueda compartirlo a mano
    // (útil sobre todo en dev, donde el email es mock).
    return NextResponse.json({ barber: created, inviteUrl }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
