import type { ChannelProvider } from "../index";
import { renderEmailHtml } from "../email-layout";

const provider = process.env.NOTIF_EMAIL_PROVIDER ?? "mock";

class ResendEmailProvider implements ChannelProvider {
  async send({
    to,
    subject,
    body,
  }: {
    to: string;
    subject?: string;
    body: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY no configurada");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // navaxa.cl es solo para envío automatizado; toda atención al cliente
        // se canaliza a contacto@nexosoftware.cl vía reply_to.
        from: "navaxa <no-reply@navaxa.cl>",
        reply_to: "contacto@nexosoftware.cl",
        to,
        subject: subject ?? "navaxa",
        // text como fallback (clientes sin HTML / antispam) + html con la marca.
        text: body,
        html: renderEmailHtml(subject ?? "navaxa", body),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Resend error ${res.status}: ${t}`);
    }
    const json = await res.json();
    return { providerId: json.id as string };
  }
}

class MockEmailProvider implements ChannelProvider {
  async send({
    to,
    subject,
    body,
  }: {
    to: string;
    subject?: string;
    body: string;
  }) {
    console.log(`[Email mock] → ${to} | ${subject ?? "(sin asunto)"}\n${body}\n---`);
    return { providerId: `mock_email_${Date.now()}` };
  }
}

export const emailProvider: ChannelProvider =
  provider === "resend" ? new ResendEmailProvider() : new MockEmailProvider();
