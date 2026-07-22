import { prisma, type SalePaymentMethod } from "@navaxa/db";
import { ApiError } from "./api-errors";
import {
  balanceItemLabel,
  computeAppointmentBalance,
  isChargeableStatus,
} from "./appointment-balance";

/**
 * Cobro del saldo pendiente de una cita, en el local.
 *
 * No pasa por `createSale`: esa función arma el total desde el catálogo
 * (unitPrice × qty) y acá el monto es arbitrario (el saldo, o una parte). El
 * precedente es `confirmGiftCardOrder`, que también crea su `Sale` directo con
 * un item de línea libre.
 *
 * La venta queda con `kind: APPOINTMENT_BALANCE` para que los reportes NO la
 * cuenten como ingreso nuevo: el ingreso del servicio ya se reconoce con el
 * `totalPrice` de la cita completada. Ver el enum SaleKind en el schema.
 *
 * NO toca stock (no hay productos), ni `Commission`, ni `client.totalSpent`:
 * `completeAppointment` ya los movió con el precio completo del servicio.
 */
export async function chargeAppointmentBalance(input: {
  tenantId: string;
  appointmentId: string;
  amount: number;
  paymentMethod: SalePaymentMethod;
  note?: string;
}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ApiError(400, "El monto a cobrar debe ser mayor a cero.");
  }

  return prisma.$transaction(async (tx) => {
    // Se relee todo DENTRO de la transacción: el saldo se recalcula en el
    // servidor y nunca se confía en el monto que mandó el cliente. Dos submits
    // simultáneos por el mismo saldo dejan al segundo sin saldo que cobrar.
    const appointment = await tx.appointment.findFirst({
      where: { id: input.appointmentId, tenantId: input.tenantId },
      select: {
        id: true,
        clientId: true,
        barberId: true,
        status: true,
        totalPrice: true,
        payment: { select: { amount: true, status: true } },
        sales: { where: { cancelledAt: null }, select: { total: true } },
        services: { select: { service: { select: { name: true } } } },
      },
    });
    if (!appointment) throw new ApiError(404, "Cita no encontrada.");

    if (!isChargeableStatus(appointment.status)) {
      throw new ApiError(
        409,
        appointment.status === "PENDING_PAYMENT"
          ? "La cita todavía está esperando el abono online."
          : "La cita está cancelada.",
      );
    }

    const { balance } = computeAppointmentBalance({
      totalPrice: appointment.totalPrice,
      payment: appointment.payment,
      sales: appointment.sales,
    });

    if (balance <= 0) throw new ApiError(409, "Esta cita ya está pagada por completo.");
    if (input.amount > balance) {
      throw new ApiError(400, "El monto supera el saldo pendiente de la cita.");
    }

    const label = balanceItemLabel(appointment.services.map((s) => s.service.name));

    const sale = await tx.sale.create({
      data: {
        tenantId: input.tenantId,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        barberId: appointment.barberId,
        total: input.amount,
        paymentMethod: input.paymentMethod,
        kind: "APPOINTMENT_BALANCE",
        note: input.note,
        items: { create: [{ name: label, unitPrice: input.amount, qty: 1 }] },
      },
      select: { id: true, total: true, paymentMethod: true, createdAt: true },
    });

    const remaining = balance - input.amount;

    // Si este cobro salda la cita, los links/QR de pago online que estuvieran
    // circulando quedan sin objeto: se anulan acá para que el cliente no pague
    // por segunda vez algo ya cobrado en el local (el sobrepago no se puede
    // rechazar después: Transbank ya movió la plata).
    if (remaining <= 0) {
      await tx.appointmentCharge.updateMany({
        where: { appointmentId: appointment.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    }

    return { sale, balance: remaining };
  });
}
