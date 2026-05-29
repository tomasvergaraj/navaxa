import { NextResponse } from "next/server";
import { loadAppointmentByToken } from "@/lib/public-booking";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const appt = await loadAppointmentByToken(params.token);
    if (!appt) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const durationMin = Math.round((+appt.endsAt - +appt.startsAt) / 60000);

    return NextResponse.json({
      appointment: {
        id: appt.id,
        status: appt.status,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        barberId: appt.barberId,
        barberName: appt.barber.user.name,
        clientFirstName: appt.client.firstName,
        totalPrice: appt.totalPrice,
        durationMin,
        serviceIds: appt.services.map((s) => s.service.id),
        services: appt.services.map((s) => ({ name: s.service.name, price: s.service.price })),
        slug: appt.tenant.slug,
        shopName: appt.tenant.name,
        address: appt.tenant.address ?? null,
        timezone: appt.tenant.timezone ?? "America/Santiago",
        // Abono: monto y estado (para mostrar abono pagado + saldo en el local).
        deposit: appt.payment ? { amount: appt.payment.amount, status: appt.payment.status } : null,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
