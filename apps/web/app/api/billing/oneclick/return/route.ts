import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { finishOneclickInscription } from "@/lib/oneclick";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BACK = `${APP_URL}/configuracion?tab=plan`;

/**
 * Return URL de la inscripción Oneclick. Transbank vuelve con `TBK_TOKEN` (POST
 * form-encoded, o GET según el flujo) y nada más: no hay sesión ni cookie útil
 * acá — el POST es cross-site, así que una cookie SameSite=Lax no viaja. Por eso
 * el token quedó guardado en `subscriptions.oneclickToken` al iniciar, y es lo
 * que nos dice de qué tenant es esta vuelta.
 *
 * Confirmar la inscripción NO cobra nada: solo deja el `tbk_user` con el que
 * después cobra `processSubscriptionRenewals`.
 */
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const form = req.method === "POST" ? await req.formData().catch(() => null) : null;
  const token = String(
    form?.get("TBK_TOKEN") ?? url.searchParams.get("TBK_TOKEN") ?? "",
  );

  if (!token) {
    // El usuario abortó en el formulario de Transbank.
    return NextResponse.redirect(`${BACK}&card=cancel`, 303);
  }

  const sub = await prisma.subscription.findUnique({
    where: { oneclickToken: token },
    select: { id: true, tenantId: true, oneclickUsername: true },
  });
  if (!sub) {
    // Token desconocido o inscripción ya confirmada (doble submit del return).
    return NextResponse.redirect(`${BACK}&card=error`, 303);
  }

  let result;
  try {
    result = await finishOneclickInscription(token);
  } catch (e) {
    console.error("[oneclick] finish falló:", (e as Error).message);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { oneclickToken: null },
    });
    return NextResponse.redirect(`${BACK}&card=error`, 303);
  }

  if (result.response_code !== 0 || !result.tbk_user) {
    // Tarjeta rechazada por el emisor. Se limpia el token para que un reintento
    // parta de cero (Transbank no acepta confirmar dos veces el mismo).
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { oneclickToken: null },
    });
    return NextResponse.redirect(`${BACK}&card=rechazada`, 303);
  }

  // card_number viene enmascarado por Transbank ("XXXXXXXXXXXX6623"): guardamos
  // solo los 4 últimos, que es lo único que mostramos.
  const digits = (result.card_number ?? "").replace(/\D/g, "");
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      oneclickTbkUser: result.tbk_user,
      oneclickToken: null,
      cardBrand: result.card_type ?? null,
      cardLast4: digits.length >= 4 ? digits.slice(-4) : null,
      cardInscribedAt: new Date(),
      provider: "oneclick",
      // La tarjeta nueva reinicia los reintentos: el cobro que venía fallando
      // por tarjeta vencida debe poder volver a intentarse hoy mismo.
      renewalAttempts: 0,
      lastRenewalError: null,
      lastRenewalAttemptAt: null,
    },
  });

  return NextResponse.redirect(`${BACK}&card=ok`, 303);
}

export const POST = handle;
export const GET = handle;
