export type TemplateKey =
  | "reminder_24h"
  | "reminder_1h"
  | "thanks_post_visit"
  | "recall_30d"
  | "birthday"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "barber_invite"
  | "password_reset";

interface Template {
  subject?: string;
  body: string;
}

const TEMPLATES: Record<TemplateKey, Template> = {
  reminder_24h: {
    subject: "Te esperamos mañana en {shopName}",
    body:
      "Hola {firstName} 👋 Te recordamos tu hora mañana {date} a las {time} con {barberName}. ¿Confirmas? Responde SÍ o NO.",
  },
  reminder_1h: {
    body:
      "Hola {firstName}, te esperamos en una hora en {shopName}. Dirección: {address}.",
  },
  thanks_post_visit: {
    body:
      "Gracias por tu visita, {firstName}. ¿Qué tal quedó el corte? Tu opinión nos ayuda a mejorar 🙏",
  },
  recall_30d: {
    body:
      "Hola {firstName}, hace un mes que no nos vemos. {barberName} tiene horas disponibles esta semana. Reserva acá: {bookingUrl}",
  },
  birthday: {
    body:
      "¡Feliz cumpleaños, {firstName}! 🎉 Tienes 20% off en tu próximo corte. Te esperamos en {shopName}.",
  },
  appointment_confirmed: {
    subject: "Hora confirmada en {shopName}",
    body:
      "Tu hora quedó confirmada: {date} {time} con {barberName} en {shopName}. ¡Nos vemos!",
  },
  appointment_cancelled: {
    subject: "Hora cancelada",
    body:
      "Tu hora del {date} a las {time} fue cancelada. Si quieres reagendar, responde este mensaje.",
  },
  barber_invite: {
    subject: "Te sumaron al equipo de {shopName}",
    body:
      "Hola {firstName} 👋 {shopName} te invitó a unirte a su equipo en navaxa. Crea tu contraseña para entrar: {actionUrl}\n\nEste enlace vence en 7 días.",
  },
  password_reset: {
    subject: "Recupera tu contraseña en navaxa",
    body:
      "Hola {firstName}, recibimos una solicitud para restablecer tu contraseña. Crea una nueva acá: {actionUrl}\n\nEl enlace vence en 1 hora. Si no fuiste tú, ignora este mensaje.",
  },
};

export function renderTemplate(
  key: TemplateKey,
  data: Record<string, string | number>,
): { subject?: string; body: string } {
  const tpl = TEMPLATES[key];
  const replace = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k) =>
      data[k] !== undefined ? String(data[k]) : `{${k}}`,
    );
  return {
    subject: tpl.subject ? replace(tpl.subject) : undefined,
    body: replace(tpl.body),
  };
}
