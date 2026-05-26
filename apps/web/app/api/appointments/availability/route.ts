import { NextResponse } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { availabilityQuerySchema } from "@/lib/validators";
import { getAvailableSlots } from "@/lib/booking";
import { prisma } from "@navaxa/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { tenantId } = getTenantContext();
    const parsed = availabilityQuerySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { barberId, date, serviceIds } = parsed.data;

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, tenantId, active: true },
    });
    if (!barber) return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
      select: { durationMin: true },
    });
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: "Servicios inválidos" }, { status: 400 });
    }
    const durationMin = services.reduce((s, x) => s + x.durationMin, 0);

    const slots = await getAvailableSlots({
      barberId,
      date: new Date(date),
      durationMin,
    });

    return NextResponse.json({ slots, durationMin });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
