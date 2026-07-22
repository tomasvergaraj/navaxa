import { prisma, type Prisma } from "@navaxa/db";
import { refundGiftCardTx } from "./giftcards";

/**
 * Liberación de la hora cuando un abono no se concreta. Vive aparte de
 * lib/payments.ts a propósito: el job de expiración lo alcanza desde
 * instrumentation.ts, que webpack bundlea también para Edge, y lib/payments.ts
 * arrastra `node:crypto` (firma de tokens) que ahí no resuelve.
 */

/**
 * Devuelve el saldo de giftcard consumido por un abono que no se concretó
 * (expiró, falló o el cliente lo canceló), para que no quede consumido por una
 * reserva que nunca existió.
 */
async function refundPaymentGiftCard(
  tx: Prisma.TransactionClient,
  payment: { id: string; tenantId: string; giftCardId: string | null; giftCardAmount: number },
  note: string,
) {
  if (!payment.giftCardId || payment.giftCardAmount <= 0) return;
  await refundGiftCardTx(tx, {
    tenantId: payment.tenantId,
    giftCardId: payment.giftCardId,
    amount: payment.giftCardAmount,
    paymentId: payment.id,
    note,
  });
}

/**
 * Marca un pago PENDING como FAILED/EXPIRED y cancela la cita que lo esperaba,
 * en la misma transacción. Si el abono no se concreta, la reserva NO debe quedar
 * agendada: la cita se cancela y el slot se libera. Si el cliente alcanzó a
 * aplicar una giftcard, ese saldo se devuelve acá mismo.
 *
 * Idempotente y a prueba de carreras: solo actúa si el pago sigue PENDING (y el
 * refund cuelga de ese mismo claim, así que no se devuelve saldo dos veces), y
 * solo cancela la cita si sigue PENDING_PAYMENT (no toca una cita que el dueño
 * haya confirmado a mano mientras tanto).
 */
export async function releasePaymentSlot(
  paymentId: string,
  appointmentId: string,
  status: "FAILED" | "EXPIRED",
) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, tenantId: true, giftCardId: true, giftCardAmount: true },
    });
    if (!payment) return;
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status },
    });
    if (claimed.count === 0) return;
    await refundPaymentGiftCard(tx, payment, "Abono de reserva no concretado");
    await tx.appointment.updateMany({
      where: { id: appointmentId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Abono no pagado" },
    });
  });
}

export async function failPaymentAndReleaseSlot(paymentId: string, appointmentId: string) {
  return releasePaymentSlot(paymentId, appointmentId, "FAILED");
}
