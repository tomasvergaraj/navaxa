import { prisma, NotificationChannel, AppointmentStatus, Plan } from "@navaxa/db";
import { sendNotification } from "./index";
import { pickChannel } from "./channel";
import { addHours, addMinutes, subHours } from "date-fns";
import { formatDate, formatTime } from "../format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://navaxa.cl";

/**
 * Recordatorios de citas (24h o 1h antes), pensado para correr cada ~15 min.
 * Requiere una campaña activa con trigger APPOINTMENT_REMINDER y el templateKey dado.
 * Idempotente: no reenvía si ya se notificó el mismo recordatorio en la ventana.
 */
async function processReminders(templateKey: "reminder_24h" | "reminder_1h", hoursAhead: number) {
  const now = new Date();
  const targetStart = addHours(now, hoursAhead);
  const targetEnd = addMinutes(targetStart, 15); // ventana de 15 min

  const appts = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: targetStart, lt: targetEnd },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
    },
    include: {
      client: { select: { firstName: true, phone: true, email: true } },
      barber: { include: { user: { select: { name: true } } } },
      tenant: { select: { name: true, address: true, plan: true } },
    },
  });

  const results: { appointmentId: string; ok: boolean }[] = [];
  for (const a of appts) {
    const campaign = await prisma.campaign.findFirst({
      where: { tenantId: a.tenantId, active: true, trigger: "APPOINTMENT_REMINDER", templateKey },
    });
    if (!campaign) continue;

    // Canal según plan: WhatsApp solo PRO/ENTERPRISE; si no, degrada a email.
    const target = pickChannel(
      a.tenant.plan,
      a.client,
      campaign.channel === NotificationChannel.WHATSAPP,
    );
    if (!target) continue;

    const already = await prisma.notificationLog.findFirst({
      where: {
        tenantId: a.tenantId,
        recipient: target.recipient,
        templateKey,
        createdAt: { gte: subHours(now, hoursAhead + 1) },
      },
    });
    if (already) continue;

    const r = await sendNotification({
      tenantId: a.tenantId,
      channel: target.channel,
      recipient: target.recipient,
      templateKey,
      data: {
        firstName: a.client.firstName,
        shopName: a.tenant.name,
        address: a.tenant.address ?? "",
        barberName: a.barber.user.name,
        date: formatDate(a.startsAt),
        time: formatTime(a.startsAt),
      },
    });
    results.push({ appointmentId: a.id, ok: r.ok });
  }

  return { processed: results.length, results };
}

/** Recordatorio 24h antes de la cita. */
export const processReminders24h = () => processReminders("reminder_24h", 24);

/** Recordatorio 1h antes de la cita. */
export const processReminders1h = () => processReminders("reminder_1h", 1);

/**
 * Libera las horas cuyo abono no se pagó dentro del plazo: marca el pago como
 * EXPIRED y cancela la cita PENDING_PAYMENT. Pensado para correr cada ~15 min.
 */
export async function expirePendingPayments() {
  const now = new Date();
  const expired = await prisma.payment.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, appointmentId: true },
    take: 200,
  });

  for (const p of expired) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: p.id }, data: { status: "EXPIRED" } }),
      prisma.appointment.update({
        where: { id: p.appointmentId },
        data: { status: "CANCELLED" },
      }),
    ]);
  }

  return { expired: expired.length };
}

/**
 * Procesa las suscripciones cuyo período venció. Las marcadas para cancelar
 * bajan a FREE; el resto quedan PAST_DUE (con pasarela real se intentaría cobrar
 * de nuevo aquí). Pensado para correr cada ~hora.
 */
export async function processSubscriptionRenewals() {
  const now = new Date();
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
    select: { id: true, tenantId: true, cancelAtPeriodEnd: true },
    take: 200,
  });

  let downgraded = 0;
  let pastDue = 0;
  for (const s of due) {
    if (s.cancelAtPeriodEnd) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: s.id },
          data: { status: "CANCELED", plan: Plan.FREE, currentPeriodEnd: null },
        }),
        prisma.tenant.update({ where: { id: s.tenantId }, data: { plan: Plan.FREE } }),
      ]);
      downgraded++;
    } else {
      await prisma.subscription.update({ where: { id: s.id }, data: { status: "PAST_DUE" } });
      pastDue++;
    }
  }

  return { downgraded, pastDue };
}

/**
 * Reactivación de clientes inactivos hace 30+ días.
 * Pensado para correr una vez al día.
 */
export async function processInactiveRecalls() {
  const cutoff = subHours(new Date(), 30 * 24);

  const clients = await prisma.client.findMany({
    where: {
      lastVisitAt: { lt: cutoff },
      phone: { not: null },
      totalVisits: { gte: 2 },
    },
    select: {
      id: true,
      firstName: true,
      phone: true,
      email: true,
      tenantId: true,
      lastVisitAt: true,
      tenant: { select: { name: true, slug: true, plan: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const c of clients) {
    const campaign = await prisma.campaign.findFirst({
      where: { tenantId: c.tenantId, active: true, trigger: "RECALL_INACTIVE" },
    });
    if (!campaign) continue;

    const target = pickChannel(
      c.tenant.plan,
      c,
      campaign.channel === NotificationChannel.WHATSAPP,
    );
    if (!target) continue;

    const already = await prisma.notificationLog.findFirst({
      where: {
        tenantId: c.tenantId,
        recipient: target.recipient,
        templateKey: "recall_30d",
        createdAt: { gte: subHours(new Date(), 60 * 24) },
      },
    });
    if (already) continue;

    await sendNotification({
      tenantId: c.tenantId,
      channel: target.channel,
      recipient: target.recipient,
      templateKey: "recall_30d",
      data: {
        firstName: c.firstName,
        barberName: "tu barbero",
        bookingUrl: `${APP_URL}/reservar/${c.tenant.slug}`,
      },
    });
    sent++;
  }
  return { sent };
}
