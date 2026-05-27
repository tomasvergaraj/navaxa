import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { scheduleSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// Reemplaza el horario semanal completo del barbero por el conjunto de ventanas recibido.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    requireManager();
    const parsed = scheduleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verifica que el barbero pertenezca al tenant (scopedDb filtra por tenantId).
    const db = scopedDb();
    const barber = await db.barber.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!barber) return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });

    // BarberSchedule no tiene tenantId → se opera con prisma directo, ya validado el dueño.
    await prisma.$transaction([
      prisma.barberSchedule.deleteMany({ where: { barberId: params.id } }),
      prisma.barberSchedule.createMany({
        data: parsed.data.windows.map((w) => ({
          barberId: params.id,
          weekday: w.weekday,
          startMin: w.startMin,
          endMin: w.endMin,
        })),
      }),
    ]);

    const schedule = await prisma.barberSchedule.findMany({
      where: { barberId: params.id },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    });
    return NextResponse.json({ schedule });
  } catch (e) {
    return apiError(e);
  }
}
