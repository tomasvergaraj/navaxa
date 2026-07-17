import { prisma, NotificationChannel, type Plan } from "@navaxa/db";
import { subHours } from "date-fns";
import { sendNotification } from "./index";
import { pickChannel } from "./channel";
import {
  BROADCAST_MAX_RECIPIENTS,
  type BroadcastSegment,
  type BroadcastTemplateKey,
} from "../campaigns";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://navaxa.cl";

interface BroadcastClient {
  id: string;
  firstName: string;
  phone: string | null;
  email: string | null;
}

/**
 * Resuelve los clientes de un segmento para un tenant, con contacto (teléfono
 * o email) y acotado a BROADCAST_MAX_RECIPIENTS. `days` solo aplica al
 * segmento "inactive".
 */
async function resolveSegment(
  tenantId: string,
  segment: BroadcastSegment,
  days: number,
): Promise<BroadcastClient[]> {
  const withContact = {
    OR: [{ phone: { not: null } }, { email: { not: null } }],
  };
  const select = { id: true, firstName: true, phone: true, email: true } as const;

  if (segment === "inactive") {
    const cutoff = subHours(new Date(), Math.max(1, days) * 24);
    return prisma.client.findMany({
      where: { tenantId, lastVisitAt: { lt: cutoff }, ...withContact },
      select,
      orderBy: { lastVisitAt: "asc" },
      take: BROADCAST_MAX_RECIPIENTS,
    });
  }

  if (segment === "birthday_month") {
    const month = new Date().getMonth() + 1;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM clients
      WHERE "tenantId" = ${tenantId}
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${month}
        AND (phone IS NOT NULL OR email IS NOT NULL)
      LIMIT ${BROADCAST_MAX_RECIPIENTS}
    `;
    if (rows.length === 0) return [];
    return prisma.client.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select,
    });
  }

  // "all"
  return prisma.client.findMany({
    where: { tenantId, ...withContact },
    select,
    orderBy: { createdAt: "desc" },
    take: BROADCAST_MAX_RECIPIENTS,
  });
}

/** Cuántos clientes recibiría el envío (para la vista previa antes de mandar). */
export async function countSegment(
  tenantId: string,
  segment: BroadcastSegment,
  days: number,
): Promise<number> {
  const clients = await resolveSegment(tenantId, segment, days);
  return clients.length;
}

/** Arma los placeholders de la plantilla para un cliente del segmento. */
function templateData(
  templateKey: BroadcastTemplateKey,
  client: BroadcastClient,
  tenant: { name: string; slug: string },
): Record<string, string | number> {
  switch (templateKey) {
    case "recall_30d":
      return {
        firstName: client.firstName,
        barberName: "tu barbero",
        bookingUrl: `${APP_URL}/reservar/${tenant.slug}`,
      };
    case "birthday":
      return { firstName: client.firstName, shopName: tenant.name };
    case "thanks_post_visit":
      return { firstName: client.firstName };
  }
}

/**
 * Envío manual a un segmento, ahora mismo. Respeta la degradación de canal y
 * el cupo mensual de WhatsApp (pickChannel). Cada envío queda en NotificationLog.
 * Devuelve cuántos se enviaron y cuántos se saltaron por no tener canal
 * disponible (cupo agotado y sin email).
 */
export async function sendBroadcast(input: {
  tenantId: string;
  plan: Plan;
  segment: BroadcastSegment;
  days: number;
  templateKey: BroadcastTemplateKey;
  preferWhatsApp: boolean;
}): Promise<{ sent: number; skipped: number; total: number }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true, slug: true },
  });
  if (!tenant) return { sent: 0, skipped: 0, total: 0 };

  const clients = await resolveSegment(input.tenantId, input.segment, input.days);

  let sent = 0;
  let skipped = 0;
  for (const c of clients) {
    const target = await pickChannel({ id: input.tenantId, plan: input.plan }, c, {
      preferWhatsApp: input.preferWhatsApp,
      whatsappFallback: true,
    });
    if (!target) {
      skipped++;
      continue;
    }
    const r = await sendNotification({
      tenantId: input.tenantId,
      channel: target.channel,
      recipient: target.recipient,
      templateKey: input.templateKey,
      data: templateData(input.templateKey, c, tenant),
    });
    if (r.ok) sent++;
    else skipped++;
  }

  return { sent, skipped, total: clients.length };
}
