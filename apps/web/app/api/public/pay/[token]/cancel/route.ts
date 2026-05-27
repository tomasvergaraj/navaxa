import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { loadPaymentByToken } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/** El cliente abandona el pago: se libera la hora reservada. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const limit = rateLimit(`paycancel:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
    }

    const payment = await loadPaymentByToken(params.token);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    if (payment.status === "PAID") {
      return NextResponse.json({ error: "El pago ya se completó" }, { status: 409 });
    }

    if (payment.status === "PENDING") {
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
        prisma.appointment.update({ where: { id: payment.appointmentId }, data: { status: "CANCELLED" } }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
