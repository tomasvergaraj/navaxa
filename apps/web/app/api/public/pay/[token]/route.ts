import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { loadPaymentByToken, getPaymentProvider, releasePaymentSlot } from "@/lib/payments";
import { signManageToken } from "@/lib/public-booking";
import { notifyAppointment } from "@/lib/appointment-notify";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Confirma el pago del abono (proveedor mock). Con una pasarela real, este
 * trabajo lo haría el webhook del proveedor; aquí lo dispara el botón "Pagar".
 * Idempotente: si ya estaba pagado, devuelve ok con el token de gestión.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const limit = rateLimit(`pay:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const payment = await loadPaymentByToken(params.token);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    // Ya pagado: idempotente.
    if (payment.status === "PAID") {
      return NextResponse.json({ ok: true, manageToken: signManageToken(payment.appointmentId) });
    }

    if (payment.status !== "PENDING") {
      return NextResponse.json({ error: "Este pago ya no está vigente" }, { status: 409 });
    }

    // Este endpoint solo confirma pagos del proveedor MOCK (botón "Pagar" del
    // checkout simulado). Con una pasarela real (Webpay) la confirmación llega
    // exclusivamente por su return handler tras `commitWebpayTransaction`; si no
    // se gatea acá, un cliente marca su reserva como pagada sin pagar (bypass del
    // abono). Chequeamos tanto el provider persistido como el activo, para que un
    // valor viejo en la fila no reabra el hueco.
    if (payment.provider !== "mock" || getPaymentProvider().name !== "mock") {
      return NextResponse.json(
        { error: "Este pago se confirma en la pasarela." },
        { status: 409 },
      );
    }

    // Expirado: liberar la hora (y devolver el saldo de giftcard, si aplicó).
    if (payment.expiresAt < new Date()) {
      await releasePaymentSlot(payment.id, payment.appointmentId, "EXPIRED");
      return NextResponse.json({ error: "El tiempo para pagar expiró. Reserva de nuevo." }, { status: 410 });
    }

    // Marcar pagado y confirmar la cita (atómico, race-safe ante doble pago).
    const claimed = await prisma.$transaction(async (tx) => {
      const c = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (c.count === 0) return false;
      await tx.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: "SCHEDULED" },
      });
      return true;
    });

    // Perdió la carrera (ya estaba pagado por otra request): idempotente.
    if (!claimed) {
      return NextResponse.json({ ok: true, manageToken: signManageToken(payment.appointmentId) });
    }

    // Aviso de hora agendada al cliente (no bloquea la respuesta si falla el envío).
    await notifyAppointment("scheduled", payment.tenant, payment.appointment).catch(() => undefined);

    return NextResponse.json({ ok: true, manageToken: signManageToken(payment.appointmentId) });
  } catch (e) {
    return apiError(e);
  }
}
