import { NotificationChannel } from "@navaxa/db";
import { sendNotification } from "@/lib/notifications";

interface NotifyTenant {
  id: string;
  name: string;
  address?: string | null;
  timezone?: string | null;
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

/** Elige canal según los datos de contacto del cliente (WhatsApp tiene prioridad). */
function pickChannel(client: NotifyAppointment["client"]):
  | { channel: NotificationChannel; recipient: string }
  | null {
  if (client.phone) return { channel: NotificationChannel.WHATSAPP, recipient: client.phone };
  if (client.email) return { channel: NotificationChannel.EMAIL, recipient: client.email };
  return null;
}

/**
 * Notifica al cliente la confirmación o cancelación de su cita.
 * No lanza: si falla el envío queda registrado en NotificationLog.
 */
export async function notifyAppointment(
  kind: "confirmed" | "cancelled",
  tenant: NotifyTenant,
  appointment: NotifyAppointment,
) {
  const target = pickChannel(appointment.client);
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
