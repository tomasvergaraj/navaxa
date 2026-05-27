import { prisma } from "@navaxa/db";
import { sendNotification } from "@/lib/notifications";
import { pickChannel } from "@/lib/notifications/channel";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---- Token de reseña (stateless, HMAC) ----
export function signReviewToken(appointmentId: string): string {
  return signToken("review", appointmentId, TOKEN_TTL.review);
}

export function verifyReviewToken(token: string): string | null {
  return verifyToken("review", token);
}

export function buildReviewUrl(appointmentId: string): string {
  return `${APP_URL}/resena/${signReviewToken(appointmentId)}`;
}

/**
 * Envía al cliente la invitación a reseñar tras completar su cita.
 * No lanza (los errores quedan en NotificationLog) e es idempotente por cita.
 */
export async function sendReviewRequest(appointmentId: string, tenantId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    select: {
      id: true,
      client: { select: { firstName: true, phone: true, email: true } },
      tenant: { select: { name: true, plan: true } },
    },
  });
  if (!appt) return { ok: false as const, error: "Cita no encontrada" };

  const target = pickChannel(appt.tenant.plan, appt.client);
  if (!target) return { ok: false as const, error: "Cliente sin canal de contacto" };

  // Idempotencia: una sola invitación por cita.
  const already = await prisma.notificationLog.findFirst({
    where: {
      tenantId,
      templateKey: "review_request",
      payload: { path: ["appointmentId"], equals: appointmentId },
    },
    select: { id: true },
  });
  if (already) return { ok: true as const, skipped: true as const };

  return sendNotification({
    tenantId,
    channel: target.channel,
    recipient: target.recipient,
    templateKey: "review_request",
    data: {
      appointmentId,
      firstName: appt.client.firstName,
      shopName: appt.tenant.name,
      reviewUrl: buildReviewUrl(appointmentId),
    },
  });
}
