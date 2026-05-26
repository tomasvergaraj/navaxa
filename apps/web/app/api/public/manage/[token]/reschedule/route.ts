import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { rescheduleAppointment } from "@/lib/booking";
import { loadAppointmentByToken } from "@/lib/public-booking";
import { rescheduleSchema } from "@/lib/validators";
import { notifyAppointment } from "@/lib/appointment-notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const appt = await loadAppointmentByToken(params.token);
  if (!appt) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  const parsed = rescheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const newStart = new Date(parsed.data.startsAt);

  const minStart = addMinutes(new Date(), appt.tenant.bookingNoticeMin);
  if (newStart < minStart) {
    return NextResponse.json({ error: "El horario ya no está disponible" }, { status: 409 });
  }

  let updated;
  try {
    updated = await rescheduleAppointment(appt.id, appt.tenant.id, newStart);
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg.includes("ocupado") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // Reenvía confirmación con el nuevo horario.
  await notifyAppointment("confirmed", appt.tenant, updated).catch(() => undefined);

  return NextResponse.json({ ok: true, startsAt: updated.startsAt, endsAt: updated.endsAt });
}
