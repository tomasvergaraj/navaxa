import { NotificationChannel, type Plan } from "@navaxa/db";

/** WhatsApp es feature de plan PRO/ENTERPRISE (ver COSTS.md). */
export function planAllowsWhatsApp(plan: Plan): boolean {
  return plan === "PRO" || plan === "ENTERPRISE";
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
 * Elige el canal de notificación respetando el plan: WhatsApp solo si el plan
 * lo incluye, se prefiere Y está vivo; si no, degrada a email. Devuelve null si
 * no hay canal disponible (p.ej. FREE/STARTER con solo teléfono y sin email, o
 * WhatsApp mock + cliente sin email).
 */
export function pickChannel(
  plan: Plan,
  client: { phone?: string | null; email?: string | null },
  preferWhatsApp = true,
): { channel: NotificationChannel; recipient: string } | null {
  if (preferWhatsApp && planAllowsWhatsApp(plan) && whatsappLive() && client.phone) {
    return { channel: NotificationChannel.WHATSAPP, recipient: client.phone };
  }
  if (client.email) return { channel: NotificationChannel.EMAIL, recipient: client.email };
  return null;
}
