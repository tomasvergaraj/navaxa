import { prisma, NotificationChannel, NotificationStatus, type Plan } from "@navaxa/db";
import { PLANS } from "@navaxa/config";

/** WhatsApp es feature de plan PRO/ENTERPRISE (ver COSTS.md). */
export function planAllowsWhatsApp(plan: Plan): boolean {
  return whatsappMonthlyLimit(plan) > 0;
}

/** Cupo mensual de mensajes WhatsApp incluido en el plan (0 = sin WhatsApp). */
export function whatsappMonthlyLimit(plan: Plan): number {
  return PLANS[plan].limits.whatsappPerMonth;
}

/**
 * WhatsApp está "vivo" solo con el provider real configurado (Meta Cloud API).
 * En mock (sin número real) los envíos no llegan a nadie, así que NO se enruta
 * a WhatsApp: se degrada a email para que las notificaciones sí lleguen.
 * Al setear NOTIF_WHATSAPP_PROVIDER=meta, WhatsApp vuelve a usarse solo.
 */
export function whatsappLive(): boolean {
  return process.env.NOTIF_WHATSAPP_PROVIDER === "meta";
}

/**
 * Mensajes WhatsApp enviados por el tenant en el mes calendario en curso.
 * Cuenta sobre NotificationLog (cada envío queda registrado ahí); los FAILED
 * no suman porque nunca llegaron al proveedor → no se cobraron.
 */
export async function whatsappUsageThisMonth(tenantId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.notificationLog.count({
    where: {
      tenantId,
      channel: NotificationChannel.WHATSAPP,
      status: { not: NotificationStatus.FAILED },
      createdAt: { gte: monthStart },
    },
  });
}

export interface PickChannelOpts {
  /** Si false, se intenta email primero (default: WhatsApp primero). */
  preferWhatsApp?: boolean;
  /**
   * Solo aplica con preferWhatsApp=false: permite caer a WhatsApp cuando el
   * cliente no tiene email (p.ej. review/rating: van por email para no gastar
   * cupo, pero un cliente solo-teléfono igual recibe su link).
   */
  whatsappFallback?: boolean;
}

/**
 * Elige el canal de notificación respetando plan y cupo mensual: WhatsApp solo
 * si el plan lo incluye, está vivo, hay teléfono Y queda cupo (límite
 * whatsappPerMonth del plan, ver COSTS.md); si no, degrada a email. Devuelve
 * null si no hay canal disponible.
 */
export async function pickChannel(
  tenant: { id: string; plan: Plan },
  client: { phone?: string | null; email?: string | null },
  opts: PickChannelOpts = {},
): Promise<{ channel: NotificationChannel; recipient: string } | null> {
  const { preferWhatsApp = true, whatsappFallback = false } = opts;

  // Candidato a WhatsApp solo si pasa los chequeos baratos; el count del cupo
  // se consulta recién entonces (evita una query por envío en planes sin WA).
  const whatsappCandidate =
    planAllowsWhatsApp(tenant.plan) && whatsappLive() && !!client.phone;
  const whatsappOk = async () =>
    whatsappCandidate &&
    (await whatsappUsageThisMonth(tenant.id)) < whatsappMonthlyLimit(tenant.plan);

  if (preferWhatsApp && (await whatsappOk())) {
    return { channel: NotificationChannel.WHATSAPP, recipient: client.phone! };
  }
  if (client.email) return { channel: NotificationChannel.EMAIL, recipient: client.email };
  if (!preferWhatsApp && whatsappFallback && (await whatsappOk())) {
    return { channel: NotificationChannel.WHATSAPP, recipient: client.phone! };
  }
  return null;
}
