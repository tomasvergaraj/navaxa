import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { scopedDb, getTenantContext } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { appointmentCreateSchema } from "@/lib/validators";
import { createAppointment } from "@/lib/booking";
import { notifyAppointment } from "@/lib/appointment-notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const db = scopedDb();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const barberId = searchParams.get("barberId") ?? undefined;

    const where: any = {};
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to) where.startsAt.lte = new Date(to);
    }
    if (barberId) where.barberId = barberId;

    const appointments = await db.appointment.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: true } },
      },
    });

    return NextResponse.json({ appointments });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = getTenantContext();
    const parsed = appointmentCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const appt = await createAppointment({
      tenantId,
      clientId: parsed.data.clientId,
      barberId: parsed.data.barberId,
      startsAt: new Date(parsed.data.startsAt),
      serviceIds: parsed.data.serviceIds,
      source: parsed.data.source,
      notes: parsed.data.notes,
    });

    // Confirmación al cliente (no bloquea la respuesta si falla el envío).
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, plan: true, address: true, timezone: true },
    });
    if (tenant) await notifyAppointment("confirmed", tenant, appt).catch(() => undefined);

    return NextResponse.json({ appointment: appt }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
