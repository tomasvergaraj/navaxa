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

/**
 * Notifica al cliente la confirmación o cancelación de su cita.
 * No lanza: si falla el envío queda registrado en NotificationLog.
 * WhatsApp se usa solo en planes que lo incluyen; si no, degrada a email.
 */
export async function notifyAppointment(
  kind: "confirmed" | "cancelled",
  tenant: NotifyTenant,
  appointment: NotifyAppointment,
) {
  const target = pickChannel(tenant.plan, appointment.client);
  if (!target) return { ok: false as const, error: "Cliente sin teléfono ni email" };

  const { fecha, hora } = formatDateTime(appointment.startsAt, tenant.timezone);

  return sendNotification({
    tenantId: tenant.id,
    channel: target.channel,
    recipient: target.recipient,
    templateKey: kind === "confirmed" ? "appointment_confirmed" : "appointment_cancelled",
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
