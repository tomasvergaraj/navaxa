import { prisma } from "@navaxa/db";
import { sendNotification } from "@/lib/notifications";
import { pickChannel } from "@/lib/notifications/channel";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function signHaircutRatingToken(haircutId: string): string {
  return signToken("haircut-rate", haircutId, TOKEN_TTL.haircutRate);
}

export function verifyHaircutRatingToken(token: string): string | null {
  return verifyToken("haircut-rate", token);
}

export function buildHaircutRatingUrl(haircutId: string): string {
  return `${APP_URL}/foto/${signHaircutRatingToken(haircutId)}`;
}

/**
 * Manda al cliente el link de calificación del corte recién subido, por email
 * (WhatsApp solo como fallback, ver pickChannel). Idempotente por haircutId vía
 * NotificationLog: no se reenvía si ya hay un envío previo.
 */
export async function sendHaircutRatingRequest(haircutId: string, tenantId: string) {
  const haircut = await prisma.haircutRecord.findFirst({
    where: { id: haircutId, tenantId },
    select: {
      id: true,
      client: { select: { firstName: true, phone: true, email: true } },
      tenant: { select: { name: true, plan: true } },
    },
  });
  if (!haircut) return { ok: false as const, error: "Foto no encontrada" };

  // Email primero (no gasta cupo WhatsApp); WhatsApp solo si no hay email.
  const target = await pickChannel({ id: tenantId, plan: haircut.tenant.plan }, haircut.client, {
    preferWhatsApp: false,
    whatsappFallback: true,
  });
  if (!target) return { ok: false as const, error: "Cliente sin canal de contacto" };

  const already = await prisma.notificationLog.findFirst({
    where: {
      tenantId,
      templateKey: "haircut_rating_request",
      payload: { path: ["haircutId"], equals: haircutId },
    },
    select: { id: true },
  });
  if (already) return { ok: true as const, skipped: true as const };

  return sendNotification({
    tenantId,
    channel: target.channel,
    recipient: target.recipient,
    templateKey: "haircut_rating_request",
    data: {
      haircutId,
      firstName: haircut.client.firstName,
      shopName: haircut.tenant.name,
      ratingUrl: buildHaircutRatingUrl(haircutId),
    },
  });
}
