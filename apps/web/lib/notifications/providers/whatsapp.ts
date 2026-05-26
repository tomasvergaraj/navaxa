import type { ChannelProvider } from "../index";

const provider = process.env.NOTIF_WHATSAPP_PROVIDER ?? "mock";

class TwilioWhatsappProvider implements ChannelProvider {
  async send({ to, body }: { to: string; body: string }) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !from) {
      throw new Error("Twilio no configurado");
    }
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");

    const cleanTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: cleanTo, Body: body }),
      },
    );

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Twilio error ${res.status}: ${t}`);
    }
    const json = await res.json();
    return { providerId: json.sid as string };
  }
}

class MockWhatsappProvider implements ChannelProvider {
  async send({ to, body }: { to: string; body: string }) {
    console.log(`[WhatsApp mock] → ${to}\n${body}\n---`);
    return { providerId: `mock_wa_${Date.now()}` };
  }
}

export const whatsappProvider: ChannelProvider =
  provider === "twilio" ? new TwilioWhatsappProvider() : new MockWhatsappProvider();
