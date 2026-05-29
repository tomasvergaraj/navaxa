import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  try {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {};
        for (const s of v.statuses ?? []) {
          const err = s.errors?.[0];
          console.log(
            `[whatsapp/webhook] status=${s.status} to=${s.recipient_id} id=${s.id}` +
              (err ? ` error=${err.code}:${err.title} ${err.error_data?.details ?? ""}` : ""),
          );
        }
        for (const m of v.messages ?? []) {
          console.log(`[whatsapp/webhook] inbound from=${m.from} type=${m.type}`);
        }
      }
    }
  } catch (e) {
    console.log(`[whatsapp/webhook] parse error: ${(e as Error).message}`);
  }
  // Meta exige 200 rápido; si no, reintenta y marca el endpoint como caído.
  return NextResponse.json({ received: true });
}
