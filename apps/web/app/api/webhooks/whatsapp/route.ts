import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

/** Compara la firma X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el app
 * secret de Meta) en tiempo constante. Fail-closed si falta el secreto. */
function verifySignature(raw: string, sigHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false; // sin secreto configurado no confiamos en nadie
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sigHeader ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Webhook de WhatsApp (Meta Cloud API).
 *
 * GET  → verificación de la suscripción: Meta manda hub.mode/hub.verify_token/
 *        hub.challenge; si el token calza con WHATSAPP_WEBHOOK_VERIFY_TOKEN,
 *        devolvemos el challenge en texto plano.
 * POST → eventos: estados de entrega (sent/delivered/read/failed) y mensajes
 *        entrantes. Por ahora solo se LOGUEAN (visibles en `docker compose logs
 *        web`) para diagnóstico; el envío es saliente y no depende de esto.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

// Limpia CR/LF de valores atacante-controlados antes de loguearlos (evita log
// injection: forjar líneas de log falsas con \n).
const oneLine = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, 120);

export async function POST(req: Request): Promise<Response> {
  // Verificar firma sobre el cuerpo CRUDO antes de parsear: el endpoint es público
  // y sin esto cualquiera puede POSTear eventos forjados (hoy solo se loguean, pero
  // si el handler crece pasa a ser procesamiento spoofeado).
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: any = null;
  try {
    body = JSON.parse(raw);
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {};
        for (const s of v.statuses ?? []) {
          const err = s.errors?.[0];
          console.log(
            `[whatsapp/webhook] status=${oneLine(s.status)} to=${oneLine(s.recipient_id)} id=${oneLine(s.id)}` +
              (err ? ` error=${oneLine(err.code)}:${oneLine(err.title)} ${oneLine(err.error_data?.details)}` : ""),
          );
        }
        for (const m of v.messages ?? []) {
          console.log(`[whatsapp/webhook] inbound from=${oneLine(m.from)} type=${oneLine(m.type)}`);
        }
      }
    }
  } catch (e) {
    console.log(`[whatsapp/webhook] parse error: ${(e as Error).message}`);
  }
  // Meta exige 200 rápido; si no, reintenta y marca el endpoint como caído.
  return NextResponse.json({ received: true });
}
