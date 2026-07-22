import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import {
  chargeableAmount,
  getPaymentProvider,
  loadPaymentByToken,
  releasePaymentSlot,
} from "@/lib/payments";
import { findGiftCardByCode, redeemGiftCardTx } from "@/lib/giftcards";
import { planHasGiftCards } from "@/lib/plan-features";
import { signManageToken } from "@/lib/public-booking";
import { notifyAppointment } from "@/lib/appointment-notify";
import { payWithGiftCardSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Aplica el saldo de una giftcard al abono de una reserva pendiente.
 *
 * Dos desenlaces:
 *
 *   1. El saldo cubre el abono completo → el pago queda PAID y la cita
 *      SCHEDULED sin pasar por la pasarela (no hay dinero nuevo que cobrar).
 *   2. El saldo alcanza para parte → se guarda `giftCardAmount` y se RECREA la
 *      transacción de la pasarela por el resto, porque el `token_ws` viejo está
 *      atado al monto original y el return handler reconcilia contra el
 *      cobrable. El cliente paga la diferencia como siempre.
 *
 * Contablemente el ingreso de la parte con giftcard ya se reconoció al emitirla:
 * queda registrada aparte en `payments.giftCardAmount`, nunca como cobro nuevo.
 *
 * Una giftcard por abono: mezclar varias complica el refund y no hay caso de uso.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    // Más estricto que el resto del checkout: este endpoint prueba códigos
    // contra el saldo de la barbería y es el candidato natural a fuerza bruta.
    const limit = rateLimit(`paygc:${clientIp(req)}`, 10, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const parsed = payWithGiftCardSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    const payment = await loadPaymentByToken(params.token);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    if (payment.status === "PAID") {
      return NextResponse.json({ error: "Este abono ya está pagado" }, { status: 409 });
    }
    if (payment.status !== "PENDING") {
      return NextResponse.json({ error: "Este pago ya no está vigente" }, { status: 409 });
    }
    if (payment.expiresAt < new Date()) {
      await releasePaymentSlot(payment.id, payment.appointmentId, "EXPIRED");
      return NextResponse.json(
        { error: "El tiempo para pagar expiró. Reserva de nuevo." },
        { status: 410 },
      );
    }
    if (payment.giftCardAmount > 0) {
      return NextResponse.json(
        { error: "Ya aplicaste una giftcard a esta reserva" },
        { status: 409 },
      );
    }
    if (!planHasGiftCards(payment.tenant.plan)) {
      return NextResponse.json(
        { error: "Esta barbería no acepta giftcards" },
        { status: 403 },
      );
    }

    const card = await findGiftCardByCode(payment.tenant.id, parsed.data.code);
    if (!card) return NextResponse.json({ error: "Giftcard no encontrada" }, { status: 404 });

    const pending = chargeableAmount(payment);
    // El saldo real se re-valida dentro de redeemGiftCardTx (estado, vencimiento
    // y carrera contra otro canje); acá solo se decide cuánto pedirle.
    const apply = Math.min(card.balance, pending);
    if (apply <= 0) {
      return NextResponse.json({ error: "Esta giftcard ya no tiene saldo" }, { status: 409 });
    }

    // --- Caso 1: cubre todo el abono. Sin pasarela. ---
    // El `providerRef` viejo queda como está a propósito: si el cliente tenía el
    // formulario de la pasarela abierto en otra pestaña y lo envía, el return
    // handler encuentra el pago YA PAID y sale sin hacer commit, así que la
    // transacción no se captura y muere por timeout. Borrarlo lo dejaría ciego.
    if (apply >= pending) {
      const claimed = await prisma.$transaction(async (tx) => {
        // El claim del pago va PRIMERO: si perdió la carrera, la transacción
        // vuelve atrás y el saldo de la giftcard no se toca.
        const c = await tx.payment.updateMany({
          where: { id: payment.id, status: "PENDING", giftCardAmount: 0 },
          data: {
            status: "PAID",
            paidAt: new Date(),
            giftCardAmount: apply,
            giftCardId: card.id,
          },
        });
        if (c.count === 0) return false;
        await redeemGiftCardTx(tx, {
          tenantId: payment.tenant.id,
          giftCardId: card.id,
          amount: apply,
          paymentId: payment.id,
          note: "Abono de reserva",
        });
        await tx.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: "SCHEDULED" },
        });
        return true;
      });

      if (!claimed) {
        return NextResponse.json({ error: "El pago cambió, recarga la página" }, { status: 409 });
      }

      await notifyAppointment("scheduled", payment.tenant, payment.appointment).catch(
        () => undefined,
      );

      return NextResponse.json({
        ok: true,
        covered: true,
        applied: apply,
        manageToken: signManageToken(payment.appointmentId),
      });
    }

    // --- Caso 2: cubre parte. Recrear el cobro por la diferencia. ---
    const remaining = pending - apply;
    // Se crea ANTES de tocar el saldo: si la pasarela falla, no hay nada que
    // devolver. Una transacción de pasarela huérfana nunca se commitea y muere sola.
    let providerRef: string;
    try {
      ({ providerRef } = await getPaymentProvider().createCheckout({
        paymentId: payment.id,
        token: params.token,
        amount: remaining,
        currency: payment.currency,
        description: `Abono reserva ${payment.tenant.name}`,
      }));
    } catch {
      return NextResponse.json(
        { error: "No se pudo actualizar el pago. Intenta de nuevo." },
        { status: 502 },
      );
    }

    const claimed = await prisma.$transaction(async (tx) => {
      const c = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING", giftCardAmount: 0 },
        data: { giftCardAmount: apply, giftCardId: card.id, providerRef },
      });
      if (c.count === 0) return false;
      await redeemGiftCardTx(tx, {
        tenantId: payment.tenant.id,
        giftCardId: card.id,
        amount: apply,
        paymentId: payment.id,
        note: "Abono de reserva",
      });
      return true;
    });

    if (!claimed) {
      return NextResponse.json({ error: "El pago cambió, recarga la página" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, covered: false, applied: apply, remaining });
  } catch (e) {
    return apiError(e);
  }
}
