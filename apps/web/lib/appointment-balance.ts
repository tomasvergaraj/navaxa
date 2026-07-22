/**
 * Saldo pendiente de una cita: lo que el cliente todavía debe.
 *
 * Módulo PURO a propósito (sin `node:crypto`, sin Prisma): lo consume el server
 * component de la agenda, el endpoint de cobro y el flujo público de gestión de
 * reserva. Mismo motivo que `payment-release.ts` — `instrumentation.ts` arrastra
 * estos módulos al bundle Edge y un import de `node:crypto` rompe el build.
 *
 * REGLA CONTABLE: acá se usan `payment.amount` y `sale.total` COMPLETOS, sin
 * restar `giftCardAmount`. Lo pagado con saldo de giftcard sí extingue la deuda
 * del cliente; el descuento de `giftCardAmount` es exclusivo del reconocimiento
 * de ingreso (ahí ese dinero ya entró cuando se emitió la giftcard), no de lo
 * que falta por cobrar.
 */

/** Abono de la cita. Solo cuenta si está PAID. */
export interface BalancePayment {
  amount: number;
  status: string;
}

/** Venta ligada a la cita. El llamador ya filtró las anuladas. */
export interface BalanceSale {
  total: number;
}

export interface AppointmentBalance {
  /** Total del servicio. */
  totalPrice: number;
  /** Abono pagado + cobros posteriores. */
  paid: number;
  /** Lo que falta por cobrar. Nunca negativo. */
  balance: number;
}

export function computeAppointmentBalance(input: {
  totalPrice: number;
  payment?: BalancePayment | null;
  sales?: BalanceSale[] | null;
}): AppointmentBalance {
  const deposit = input.payment?.status === "PAID" ? input.payment.amount : 0;
  const charged = (input.sales ?? []).reduce((s, v) => s + v.total, 0);
  const paid = deposit + charged;
  return {
    totalPrice: input.totalPrice,
    paid,
    balance: Math.max(0, input.totalPrice - paid),
  };
}

/**
 * Estados en los que NO se cobra el saldo: la cita anulada no se cobra, y
 * PENDING_PAYMENT sigue dentro de la ventana del abono (su hora todavía se
 * puede liberar por expiración).
 */
const NOT_CHARGEABLE = new Set(["CANCELLED", "PENDING_PAYMENT"]);

export function isChargeableStatus(status: string): boolean {
  return !NOT_CHARGEABLE.has(status);
}
