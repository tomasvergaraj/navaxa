import { NotificationChannel, type Plan } from "@navaxa/db";

/** WhatsApp es feature de plan PRO/ENTERPRISE (ver COSTS.md). */
export function planAllowsWhatsApp(plan: Plan): boolean {
  return plan === "PRO" || plan === "ENTERPRISE";
}

/**
 * Elige el canal de notificación respetando el plan: WhatsApp solo si el plan
 * lo incluye y se prefiere; si no, degrada a email. Devuelve null si no hay
 * un canal disponible (p.ej. FREE/STARTER con solo teléfono y sin email).
 */
export function pickChannel(
  plan: Plan,
  client: { phone?: string | null; email?: string | null },
  preferWhatsApp = true,
): { channel: NotificationChannel; recipient: string } | null {
  if (preferWhatsApp && planAllowsWhatsApp(plan) && client.phone) {
    return { channel: NotificationChannel.WHATSAPP, recipient: client.phone };
  }
  if (client.email) return { channel: NotificationChannel.EMAIL, recipient: client.email };
  return null;
}
