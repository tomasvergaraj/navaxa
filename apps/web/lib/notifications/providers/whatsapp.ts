import type { ChannelProvider } from "../index";
import type { TemplateKey } from "../templates";

const provider = process.env.NOTIF_WHATSAPP_PROVIDER ?? "mock";

/**
 * Registro de templates de WhatsApp (Meta Cloud API).
 *
 * Meta NO acepta texto libre fuera de la ventana de 24h: los mensajes
 * business-initiated (recordatorios, recall, confirmaciones…) se mandan por
 * un template APROBADO, categoría Utility (ver COSTS.md). Cada entrada mapea
 * nuestra `TemplateKey` al nombre del template en Meta y al ORDEN de las
 * variables posicionales {{1}}, {{2}}, … que se mandan en `components.body`.
 *
 * IMPORTANTE: al registrar el template en Meta Business, el cuerpo debe usar
 * {{1}}…{{n}} en EXACTAMENTE este orden. El texto sugerido (mismo wording que
 * templates.ts) está en docs/whatsapp-templates.md.
 *
 * Solo se listan las keys que de verdad se enrutan a WhatsApp (citas + recall +
 * post-visita). Las de staff (barber_invite, password_reset) van por email; si
 * alguna cayera acá sin mapeo, se lanza error y queda FAILED en el log.
 */
const WA_TEMPLATES: Partial<Record<TemplateKey, { name: string; params: string[] }>> = {
  reminder_24h: { name: "reminder_24h", params: ["firstName", "date", "time", "barberName"] },
  reminder_1h: { name: "reminder_1h", params: ["firstName", "shopName", "address"] },
  thanks_post_visit: { name: "thanks_post_visit", params: ["firstName"] },
  recall_30d: { name: "recall_30d", params: ["firstName", "barberName", "bookingUrl"] },
  birthday: { name: "birthday", params: ["firstName", "shopName"] },
  appointment_confirmed: {
    name: "appointment_confirmed",
    params: ["date", "time", "barberName", "shopName"],
  },
  appointment_cancelled: { name: "appointment_cancelled", params: ["date", "time"] },
  review_request: { name: "review_request", params: ["firstName", "shopName", "reviewUrl"] },
};

/** Normaliza a dígitos con código país (Meta espera E.164 sin '+'). */
function normalizePhone(to: string): string {
  return to.replace(/^whatsapp:/, "").replace(/[^\d]/g, "");
}

class MetaWhatsappProvider implements ChannelProvider {
  async send({
    to,
    templateKey,
    data,
  }: {
    to: string;
    templateKey?: TemplateKey;
    data?: Record<string, string | number>;
  }) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
    const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "es";
    if (!phoneNumberId || !token) {
      throw new Error(
        "WhatsApp (Meta) no configurado: faltan WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN",
      );
    }
    if (!templateKey) {
      throw new Error(
        "WhatsApp requiere templateKey (Meta no admite texto libre fuera de la ventana 24h)",
      );
    }
    const tpl = WA_TEMPLATES[templateKey];
    if (!tpl) {
      throw new Error(`Sin template WhatsApp mapeado para "${templateKey}"`);
    }

    const parameters = tpl.params.map((k) => ({
      type: "text" as const,
      text: String(data?.[k] ?? ""),
    }));

    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizePhone(to),
          type: "template",
          template: {
            name: tpl.name,
            language: { code: lang },
            components: parameters.length ? [{ type: "body", parameters }] : [],
          },
        }),
      },
    );

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Meta WhatsApp error ${res.status}: ${t}`);
    }
    const json = await res.json();
    // Respuesta OK: { messaging_product, messages: [{ id }] }
    const id = json?.messages?.[0]?.id as string | undefined;
    return { providerId: id ?? `wa_${json?.messaging_product ?? "sent"}` };
  }
}

class MockWhatsappProvider implements ChannelProvider {
  async send({ to, body }: { to: string; body: string }) {
    console.log(`[WhatsApp mock] → ${to}\n${body}\n---`);
    return { providerId: `mock_wa_${normalizePhone(to)}` };
  }
}

export const whatsappProvider: ChannelProvider =
  provider === "meta" ? new MetaWhatsappProvider() : new MockWhatsappProvider();
