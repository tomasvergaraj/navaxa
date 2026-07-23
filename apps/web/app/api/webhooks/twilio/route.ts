import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma, NotificationStatus } from "@navaxa/db";

export const dynamic = "force-dynamic";

// Limpia CR/LF de valores atacante-controlados antes de loguearlos (log injection).
const oneLine = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, 120);

/**
 * Valida X-Twilio-Signature (ver docs de Twilio):
 *   base64( HMAC-SHA1( authToken, URL + concat(paramKey+paramValue) ordenados por key ) )
 *
 * La URL debe ser EXACTAMENTE la que Twilio llamó (la que configuramos en
 * StatusCallback). Detrás de nginx/Cloudflare `req.url` puede llegar como http o
 * con host interno, así que firmamos contra TWILIO_STATUS_CALLBACK_URL cuando
 * está seteada (es justo la URL que Twilio usa). Fail-closed si falta token/URL.
 */
function verifySignature(url: string, params: URLSearchParams, sigHeader: string | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !sigHeader) return false;
  const sortedKeys = [...params.keys()].sort();
  let data = url;
  for (const k of sortedKeys) data += k + (params.get(k) ?? "");
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(sigHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Mapea el MessageStatus de Twilio a nuestro NotificationStatus (o null = ignorar). */
function mapStatus(twilioStatus: string): NotificationStatus | null {
  switch (twilioStatus) {
    case "delivered":
    case "read":
      return NotificationStatus.DELIVERED;
    case "failed":
    case "undelivered":
      return NotificationStatus.FAILED;
    // queued/sent no cambian el estado (ya quedó SENT al enviar).
    default:
      return null;
  }
}

/**
 * Webhook de estados de Twilio (StatusCallback). Twilio POSTea form-encoded
 * MessageSid/MessageStatus/ErrorCode cuando cambia el estado de entrega. Casamos
 * el MessageSid contra NotificationLog.providerId (que guardamos al enviar) y
 * actualizamos a DELIVERED/FAILED. Respuesta 200 rápida (Twilio reintenta si no).
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  // Firmamos contra la URL pública configurada; si no está, no podemos validar
  // de forma confiable detrás del proxy → fail-closed.
  const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (!callbackUrl || !verifySignature(callbackUrl, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const sid = params.get("MessageSid") ?? params.get("SmsSid");
  const status = params.get("MessageStatus") ?? "";
  const errorCode = params.get("ErrorCode");

  console.log(
    `[twilio/webhook] status=${oneLine(status)} sid=${oneLine(sid)}` +
      (errorCode ? ` error=${oneLine(errorCode)}` : ""),
  );

  const mapped = sid ? mapStatus(status) : null;
  if (sid && mapped) {
    try {
      await prisma.notificationLog.updateMany({
        where: { providerId: sid },
        data: {
          status: mapped,
          ...(mapped === NotificationStatus.FAILED && errorCode
            ? { errorMessage: `Twilio error ${errorCode}` }
            : {}),
        },
      });
    } catch (e) {
      console.log(`[twilio/webhook] update error: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ received: true });
}
