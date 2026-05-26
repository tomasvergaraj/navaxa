import { NextResponse } from "next/server";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { loadAppointmentByToken } from "@/lib/public-booking";
import { notifyAppointment } from "@/lib/appointment-notify";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const appt = await loadAppointmentByToken(params.token);
  if (!appt) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  if (
    appt.status !== AppointmentStatus.SCHEDULED &&
    appt.status !== AppointmentStatus.CONFIRMED
  ) {
    return NextResponse.json({ error: "Esta reserva ya no se puede cancelar" }, { status: 409 });
  }

  await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: "Cancelada por el cliente",
    },
  });

  await notifyAppointment("cancelled", appt.tenant, appt).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
