import { type Plan } from "@navaxa/db";
import { sendNotification } from "@/lib/notifications";
import { pickChannel } from "@/lib/notifications/channel";

interface NotifyTenant {
  id: string;
  name: string;
  address?: string | null;
  timezone?: string | null;
  plan: Plan;
}

interface NotifyAppointment {
  startsAt: Date;
  client: { firstName: string; phone?: string | null; email?: string | null };
  barber: { user: { name: string } };
}

function formatDateTime(date: Date, timezone?: string | null) {
  const tz = timezone ?? "America/Santiago";
  const fecha = new Intl.DateTimeFormat("es-CL", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  const hora = new Intl.DateTimeFormat("es-CL", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return { fecha, hora };
}

const TEMPLATE_BY_KIND = {
  scheduled: "appointment_scheduled",
  confirmed: "appointment_confirmed",
  cancelled: "appointment_cancelled",
} as const;

/**
 * Notifica al cliente sobre su cita. "scheduled" al crear/reagendar (la cita
 * nace Agendada), "confirmed" cuando el local la confirma desde el panel,
 * "cancelled" al cancelar. No lanza: si falla el envío queda en NotificationLog.
 * WhatsApp se usa solo en planes que lo incluyen; si no, degrada a email.
 */
export async function notifyAppointment(
  kind: keyof typeof TEMPLATE_BY_KIND,
  tenant: NotifyTenant,
  appointment: NotifyAppointment,
) {
  const target = await pickChannel({ id: tenant.id, plan: tenant.plan }, appointment.client);
  if (!target) return { ok: false as const, error: "Cliente sin teléfono ni email" };

  const { fecha, hora } = formatDateTime(appointment.startsAt, tenant.timezone);

  return sendNotification({
    tenantId: tenant.id,
    channel: target.channel,
    recipient: target.recipient,
    templateKey: TEMPLATE_BY_KIND[kind],
    data: {
      firstName: appointment.client.firstName,
      shopName: tenant.name,
      address: tenant.address ?? "",
      barberName: appointment.barber.user.name,
      date: fecha,
      time: hora,
    },
  });
}
