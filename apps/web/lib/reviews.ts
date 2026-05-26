import crypto from "node:crypto";
import { prisma } from "@navaxa/db";
import { sendNotification } from "@/lib/notifications";
import { pickChannel } from "@/lib/notifications/channel";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---- Token de reseña (stateless, HMAC) ----
// token = b64url(appointmentId).b64url(hmac("review:appointmentId"))

function reviewSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

export function signReviewToken(appointmentId: string): string {
  const sig = crypto.createHmac("sha256", reviewSecret()).update(`review:${appointmentId}`).digest();
  return `${b64url(appointmentId)}.${b64url(sig)}`;
}

export function verifyReviewToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let appointmentId: string;
  try {
    appointmentId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = signReviewToken(appointmentId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return appointmentId;
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
