import { prisma, AppointmentStatus } from "@navaxa/db";
import { addMinutes, startOfDay, endOfDay, getDay } from "date-fns";

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailabilityInput {
  barberId: string;
  date: Date;
  durationMin: number;
  stepMin?: number;
}

/**
 * Devuelve los slots disponibles para un barbero en una fecha dada,
 * considerando su horario, citas existentes y bloques de tiempo libre.
 */
export async function getAvailableSlots({
  barberId,
  date,
  durationMin,
  stepMin = 15,
}: AvailabilityInput): Promise<Slot[]> {
  const weekday = getDay(date);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [schedule, appointments, timeOff] = await Promise.all([
    prisma.barberSchedule.findMany({ where: { barberId, weekday } }),
    prisma.appointment.findMany({
      where: {
        barberId,
        startsAt: { gte: dayStart, lte: dayEnd },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.barberTimeOff.findMany({
      where: {
        barberId,
        startsAt: { lte: dayEnd },
        endsAt: { gte: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  if (schedule.length === 0) return [];

  const blocks = [...appointments, ...timeOff].sort((a, b) => +a.startsAt - +b.startsAt);
  const slots: Slot[] = [];

  for (const window of schedule) {
    const winStart = addMinutes(dayStart, window.startMin);
    const winEnd = addMinutes(dayStart, window.endMin);

    let cursor = winStart;
    while (addMinutes(cursor, durationMin) <= winEnd) {
      const candidateEnd = addMinutes(cursor, durationMin);
      const conflict = blocks.find((b) => cursor < b.endsAt && candidateEnd > b.startsAt);

      if (!conflict) {
        slots.push({ startsAt: new Date(cursor), endsAt: candidateEnd });
        cursor = addMinutes(cursor, stepMin);
      } else {
        cursor = conflict.endsAt;
      }
    }
  }

  const now = new Date();
  return slots.filter((s) => s.startsAt > now);
}

export interface CreateAppointmentInput {
  tenantId: string;
  clientId: string;
  barberId: string;
  startsAt: Date;
  serviceIds: string[];
  source?: string;
  notes?: string;
  /** Si se pasa, la cita queda PENDING_PAYMENT y se crea un Payment en la misma tx. */
  deposit?: { amount: number; provider: string; expiresAt: Date };
}

/**
 * Crea una cita validando dentro de transacción que no haya solape
 * con otra cita activa del mismo barbero. Si se indica un abono, la cita
 * queda PENDING_PAYMENT (sigue ocupando el slot) y se crea el Payment asociado.
 */
export async function createAppointment(input: CreateAppointmentInput) {
  return prisma.$transaction(async (tx) => {
    const services = await tx.service.findMany({
      where: {
        id: { in: input.serviceIds },
        tenantId: input.tenantId,
        active: true,
      },
    });
    if (services.length !== input.serviceIds.length) {
      throw new Error("Servicios inválidos o inactivos");
    }

    const durationMin = services.reduce((s, x) => s + x.durationMin, 0);
    const total = services.reduce((s, x) => s + x.price, 0);
    const endsAt = addMinutes(input.startsAt, durationMin);

    // Verificar barbero pertenece al tenant
    const barber = await tx.barber.findFirst({
      where: { id: input.barberId, tenantId: input.tenantId, active: true },
    });
    if (!barber) throw new Error("Barbero no encontrado");

    // Verificar cliente pertenece al tenant
    const client = await tx.client.findFirst({
      where: { id: input.clientId, tenantId: input.tenantId },
    });
    if (!client) throw new Error("Cliente no encontrado");

    // Verificación de solape (race-safe dentro de tx)
    const overlap = await tx.appointment.findFirst({
      where: {
        barberId: input.barberId,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
        startsAt: { lt: endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true },
    });
    if (overlap) throw new Error("El horario ya está ocupado");

    return tx.appointment.create({
      data: {
        tenantId: input.tenantId,
        clientId: input.clientId,
        barberId: input.barberId,
        startsAt: input.startsAt,
        endsAt,
        totalPrice: total,
        status: input.deposit ? AppointmentStatus.PENDING_PAYMENT : AppointmentStatus.SCHEDULED,
        source: input.source ?? "web",
        notes: input.notes,
        services: {
          create: services.map((s) => ({ serviceId: s.id, priceCharged: s.price })),
        },
        ...(input.deposit
          ? {
              payment: {
                create: {
                  tenantId: input.tenantId,
                  amount: input.deposit.amount,
                  provider: input.deposit.provider,
                  expiresAt: input.deposit.expiresAt,
                },
              },
            }
          : {}),
      },
      include: {
        client: true,
        barber: { include: { user: true } },
        services: { include: { service: true } },
        payment: true,
      },
    });
  });
}

/**
 * Reagenda una cita a un nuevo inicio, preservando su duración y validando
 * que no haya solape con otra cita activa del mismo barbero (race-safe en tx).
 * Solo permite reagendar citas aún vigentes (SCHEDULED / CONFIRMED).
 */
export async function rescheduleAppointment(
  appointmentId: string,
  tenantId: string,
  newStart: Date,
) {
  return prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!appt) throw new Error("Cita no encontrada");
    if (
      appt.status !== AppointmentStatus.SCHEDULED &&
      appt.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new Error("La cita no se puede reagendar");
    }

    const durationMin = Math.round((+appt.endsAt - +appt.startsAt) / 60000);
    const endsAt = addMinutes(newStart, durationMin);

    const overlap = await tx.appointment.findFirst({
      where: {
        barberId: appt.barberId,
        id: { not: appt.id },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        startsAt: { lt: endsAt },
        endsAt: { gt: newStart },
      },
      select: { id: true },
    });
    if (overlap) throw new Error("El horario ya está ocupado");

    return tx.appointment.update({
      where: { id: appt.id },
      data: { startsAt: newStart, endsAt },
      include: {
        client: true,
        barber: { include: { user: true } },
        services: { include: { service: true } },
      },
    });
  });
}

/**
 * Marca una cita como completada y genera la comisión correspondiente.
 */
export async function completeAppointment(appointmentId: string, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { barber: true },
    });
    if (!appt) throw new Error("Cita no encontrada");
    if (appt.status === AppointmentStatus.COMPLETED) return appt;

    const rate = appt.barber.commissionRate;
    const amount = Math.round(appt.totalPrice * rate);

    // Período = mes calendario de la cita
    const periodStart = new Date(appt.startsAt.getFullYear(), appt.startsAt.getMonth(), 1);
    const periodEnd = new Date(appt.startsAt.getFullYear(), appt.startsAt.getMonth() + 1, 0, 23, 59, 59);

    await tx.commission.upsert({
      where: { appointmentId: appt.id },
      create: {
        tenantId,
        barberId: appt.barberId,
        appointmentId: appt.id,
        baseAmount: appt.totalPrice,
        rate,
        amount,
        periodStart,
        periodEnd,
      },
      update: { amount, rate, baseAmount: appt.totalPrice },
    });

    // Actualizar contadores del cliente
    await tx.client.update({
      where: { id: appt.clientId },
      data: {
        lastVisitAt: appt.startsAt,
        totalVisits: { increment: 1 },
        totalSpent: { increment: appt.totalPrice },
      },
    });

    return tx.appointment.update({
      where: { id: appt.id },
      data: { status: AppointmentStatus.COMPLETED },
    });
  });
}
