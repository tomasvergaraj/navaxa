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
  appointment_scheduled: {
    name: "appointment_scheduled",
    params: ["date", "time", "barberName", "shopName"],
  },
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

/**
 * Provider vía Twilio (API "Messages" clásica, no Conversations).
 *
 * Twilio manda WhatsApp business-initiated con Content Templates aprobados:
 * `ContentSid` (el HX… del template en Twilio) + `ContentVariables` (JSON con
 * las variables posicionales "1".."n"). Reusamos el MISMO orden de `WA_TEMPLATES`
 * que Meta, así que crear los templates en Twilio con {{1}}…{{n}} en ese orden
 * los deja intercambiables entre ambos proveedores.
 *
 * El mapa TemplateKey → ContentSid viene en `TWILIO_CONTENT_SIDS` como JSON
 * (p.ej. {"reminder_24h":"HX…","reminder_1h":"HX…"}). Se parsea una vez.
 */
function parseContentSids(): Record<string, string> {
  const raw = process.env.TWILIO_CONTENT_SIDS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    throw new Error("TWILIO_CONTENT_SIDS no es JSON válido");
  }
}
const contentSids = parseContentSids();

class TwilioWhatsappProvider implements ChannelProvider {
  async send({
    to,
    templateKey,
    data,
  }: {
    to: string;
    templateKey?: TemplateKey;
    data?: Record<string, string | number>;
  }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!accountSid || !authToken || !from) {
      throw new Error(
        "WhatsApp (Twilio) no configurado: faltan TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM",
      );
    }
    if (!templateKey) {
      throw new Error(
        "WhatsApp requiere templateKey (Twilio manda business-initiated con Content Template)",
      );
    }
    const tpl = WA_TEMPLATES[templateKey];
    if (!tpl) {
      throw new Error(`Sin template WhatsApp mapeado para "${templateKey}"`);
    }
    const contentSid = contentSids[templateKey];
    if (!contentSid) {
      throw new Error(`Sin ContentSid de Twilio para "${templateKey}" (revisa TWILIO_CONTENT_SIDS)`);
    }

    // Variables posicionales "1".."n" en el orden de tpl.params.
    const contentVariables: Record<string, string> = {};
    tpl.params.forEach((k, i) => {
      contentVariables[String(i + 1)] = String(data?.[k] ?? "");
    });

    // whatsapp:+<E164>. El From ya debe venir con prefijo whatsapp: en env;
    // si no, se lo agregamos por robustez.
    const toAddr = `whatsapp:+${normalizePhone(to)}`;
    const fromAddr = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

    const form = new URLSearchParams({
      To: toAddr,
      From: fromAddr,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(contentVariables),
    });
    // Twilio POSTea aquí el estado (sent/delivered/read/failed) → webhook.
    const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;
    if (statusCallback) form.set("StatusCallback", statusCallback);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Twilio WhatsApp error ${res.status}: ${t}`);
    }
    const json = await res.json();
    // Respuesta OK: { sid: "SM…", status: "queued", … }. El sid es el providerId
    // con el que el webhook de estados casa el NotificationLog.
    const id = json?.sid as string | undefined;
    return { providerId: id ?? "twilio_sent" };
  }
}

class MockWhatsappProvider implements ChannelProvider {
  async send({ to, body }: { to: string; body: string }) {
    console.log(`[WhatsApp mock] → ${to}\n${body}\n---`);
    return { providerId: `mock_wa_${normalizePhone(to)}` };
  }
}

export const whatsappProvider: ChannelProvider =
  provider === "meta"
    ? new MetaWhatsappProvider()
    : provider === "twilio"
      ? new TwilioWhatsappProvider()
      : new MockWhatsappProvider();
