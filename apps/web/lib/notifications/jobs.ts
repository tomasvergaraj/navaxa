import { prisma, Prisma, NotificationChannel, AppointmentStatus, Plan } from "@navaxa/db";
import { sendNotification } from "./index";
import { pickChannel } from "./channel";
import { addHours, addMinutes, subHours } from "date-fns";
import { formatDate, formatTime } from "../format";
import { releasePaymentSlot } from "../payment-release";

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

    // Canal según plan y cupo: WhatsApp solo PRO/ENTERPRISE con cupo mensual
    // disponible; si no, degrada a email.
    const target = await pickChannel({ id: a.tenantId, plan: a.tenant.plan }, a.client, {
      preferWhatsApp: campaign.channel === NotificationChannel.WHATSAPP,
    });
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
    // Guard de status adentro: si el return de la pasarela llegó entre el
    // findMany y acá (pago PAID / cita ya SCHEDULED), no pisarlo. Devuelve
    // también el saldo de giftcard aplicado a un abono que nunca se completó.
    await releasePaymentSlot(p.id, p.appointmentId, "EXPIRED");
  }

  return { expired: expired.length };
}

/**
 * Vence los enlaces/QR de cobro del saldo que nadie pagó. Acá no hay nada que
 * liberar: la deuda sigue viva y el dueño puede cobrarla en el local o emitir un
 * enlace nuevo.
 *
 * `updateMany` plano a propósito: este archivo lo alcanza `instrumentation.ts`,
 * que webpack bundlea también para Edge, y `lib/appointment-charge-links.ts`
 * arrastra `node:crypto` (firma de tokens) que ahí no resuelve.
 */
export async function expirePendingAppointmentCharges() {
  const res = await prisma.appointmentCharge.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return { expired: res.count };
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

/** Día/mes/año de "hoy" en la zona horaria del tenant. */
function todayInTz(timezone: string): { day: number; month: number; year: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
  } catch {
    // Timezone inválida guardada en el tenant: caer al default del producto.
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/**
 * Saludo de cumpleaños a los clientes que están de cumpleaños hoy (según la
 * zona horaria de cada tenant). Requiere campaña activa con trigger BIRTHDAY.
 * Pensado para correr una vez al día. Idempotente: no reenvía si ya se saludó
 * a ese destinatario en los últimos ~10 meses (cubre el "cumpleaños anual"
 * sin depender de la hora exacta en que corra el job).
 */
export async function processBirthdays() {
  const campaigns = await prisma.campaign.findMany({
    where: { active: true, trigger: "BIRTHDAY" },
    select: {
      tenantId: true,
      channel: true,
      tenant: { select: { name: true, plan: true, timezone: true } },
    },
  });

  let sent = 0;
  for (const c of campaigns) {
    const today = todayInTz(c.tenant.timezone);
    const isLeapYear = (today.year % 4 === 0 && today.year % 100 !== 0) || today.year % 400 === 0;
    // En años no bisiestos, los nacidos el 29/02 se saludan el 01/03.
    const includeFeb29 = today.month === 3 && today.day === 1 && !isLeapYear;

    // El filtro por día/mes no es expresable en Prisma; EXTRACT en SQL evita
    // traer todos los clientes con birthDate a memoria (regla COSTS.md).
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM clients
      WHERE "tenantId" = ${c.tenantId}
        AND "birthDate" IS NOT NULL
        AND (
          (EXTRACT(MONTH FROM "birthDate") = ${today.month} AND EXTRACT(DAY FROM "birthDate") = ${today.day})
          ${includeFeb29 ? Prisma.sql`OR (EXTRACT(MONTH FROM "birthDate") = 2 AND EXTRACT(DAY FROM "birthDate") = 29)` : Prisma.empty}
        )
      LIMIT 200
    `);
    if (rows.length === 0) continue;

    const clients = await prisma.client.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, firstName: true, phone: true, email: true },
    });

    for (const client of clients) {
      const target = await pickChannel({ id: c.tenantId, plan: c.tenant.plan }, client, {
        preferWhatsApp: c.channel === NotificationChannel.WHATSAPP,
      });
      if (!target) continue;

      const already = await prisma.notificationLog.findFirst({
        where: {
          tenantId: c.tenantId,
          recipient: target.recipient,
          templateKey: "birthday",
          createdAt: { gte: subHours(new Date(), 300 * 24) },
        },
      });
      if (already) continue;

      const r = await sendNotification({
        tenantId: c.tenantId,
        channel: target.channel,
        recipient: target.recipient,
        templateKey: "birthday",
        data: { firstName: client.firstName, shopName: c.tenant.name },
      });
      if (r.ok) sent++;
    }
  }

  return { sent };
}

/**
 * Reactivación de clientes inactivos hace 30+ días.
 * Pensado para correr una vez al día.
 */
export async function processInactiveRecalls() {
  // Cada tenant define su umbral de inactividad en la campaña
  // (conditions.daysSinceLastVisit); default 30 si no está seteado. Se agrupa
  // por tenant para no recalcular el cutoff por cliente.
  const campaigns = await prisma.campaign.findMany({
    where: { active: true, trigger: "RECALL_INACTIVE" },
    select: { tenantId: true, channel: true, conditions: true },
  });
  if (campaigns.length === 0) return { sent: 0 };

  const now = new Date();
  let sent = 0;
  for (const campaign of campaigns) {
    const cond = (campaign.conditions ?? {}) as { daysSinceLastVisit?: number };
    const days =
      typeof cond.daysSinceLastVisit === "number" && cond.daysSinceLastVisit > 0
        ? cond.daysSinceLastVisit
        : 30;
    const cutoff = subHours(now, days * 24);

    const clients = await prisma.client.findMany({
      where: {
        tenantId: campaign.tenantId,
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
        tenant: { select: { name: true, slug: true, plan: true } },
      },
      take: 100,
    });

    for (const c of clients) {
      const target = await pickChannel({ id: c.tenantId, plan: c.tenant.plan }, c, {
        preferWhatsApp: campaign.channel === NotificationChannel.WHATSAPP,
      });
      if (!target) continue;

      const already = await prisma.notificationLog.findFirst({
        where: {
          tenantId: c.tenantId,
          recipient: target.recipient,
          templateKey: "recall_30d",
          createdAt: { gte: subHours(now, 60 * 24) },
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
  }
  return { sent };
}
