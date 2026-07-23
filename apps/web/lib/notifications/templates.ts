export type TemplateKey =
  | "reminder_24h"
  | "reminder_1h"
  | "thanks_post_visit"
  | "recall_30d"
  | "birthday"
  | "appointment_scheduled"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "barber_invite"
  | "password_reset"
  | "review_request"
  | "giftcard_issued"
  | "subscription_charged"
  | "subscription_charge_failed"
  | "subscription_suspended";

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
  appointment_scheduled: {
    subject: "Hora agendada en {shopName}",
    body:
      "Tu hora quedó agendada: {date} {time} con {barberName} en {shopName}. ¡Nos vemos!",
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
  review_request: {
    subject: "¿Cómo te fue en {shopName}?",
    body:
      "Hola {firstName} 👋 Gracias por tu visita a {shopName}. ¿Nos dejas tu reseña? Toma menos de un minuto: {reviewUrl}",
  },
  giftcard_issued: {
    subject: "Tienes una giftcard de {shopName} 🎁",
    body:
      "Hola {recipientName} 👋 Recibiste una giftcard de {shopName} por ${amount}. Tu código es {code} — preséntalo al reservar o pagar. {message}",
  },
  // Facturación del SaaS: van al dueño de la barbería, no a sus clientes.
  subscription_charged: {
    subject: "Cobro de tu plan {planName} en navaxa",
    body:
      "Hola, cobramos {amount} a tu tarjeta terminada en {cardLast4} por el plan {planName} de {shopName}. Tu plan queda vigente hasta el {periodEnd}. Código de autorización: {authorizationCode}.",
  },
  subscription_charge_failed: {
    subject: "No pudimos cobrar tu plan {planName}",
    body:
      "Hola, no pudimos cobrar {amount} a tu tarjeta terminada en {cardLast4} por el plan {planName} de {shopName}. Vamos a reintentar automáticamente. Si tu tarjeta cambió, actualízala acá: {actionUrl}",
  },
  subscription_suspended: {
    subject: "Tu plan {planName} pasó a Gratis",
    body:
      "Hola, tras varios intentos no pudimos cobrar el plan {planName} de {shopName}, así que la cuenta quedó en el plan Gratis. Tus datos siguen ahí: para volver a tu plan, actualiza tu tarjeta acá: {actionUrl}",
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
