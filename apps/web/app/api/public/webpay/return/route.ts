import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { commitWebpayTransaction } from "@/lib/webpay";
import { failPaymentAndReleaseSlot, signPaymentToken } from "@/lib/payments";
import { notifyAppointment } from "@/lib/appointment-notify";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Return URL de Webpay Plus para abonos de reserva. Transbank envía al cliente
 * acá con un POST x-www-form-urlencoded. Cuatro casos posibles:
 *
 *   1. Pago OK         → form trae `token_ws`; commit devuelve response_code=0.
 *   2. Pago rechazado  → form trae `token_ws`; commit devuelve response_code!=0.
 *   3. Cliente aborta  → form trae `TBK_TOKEN` (sin token_ws) y datos de la orden.
 *   4. Timeout (10min) → form trae `TBK_TOKEN` + `TBK_ID_SESION` + `TBK_ORDEN_COMPRA`.
 *
 * En cualquier caso redirigimos con 303 al cliente a la UI correspondiente.
 */
async function handle(req: Request): Promise<Response> {
  // Webpay Plus puede devolver vía POST (form-encoded) o GET (query string),
  // y según el flujo (éxito / abort / timeout) cambian los nombres de campo.
  // Leemos de ambas fuentes para no perder ningún caso.
  const url = new URL(req.url);
  const form = req.method === "POST" ? await req.formData().catch(() => null) : null;
  const pick = (k: string) =>
    String(form?.get(k) ?? url.searchParams.get(k) ?? "");
  const tokenWs = pick("token_ws");
  const tbkToken = pick("TBK_TOKEN");
  console.log(
    `[webpay/return] method=${req.method} tokenWs=${tokenWs.slice(0, 12) || "(empty)"} tbk=${tbkToken.slice(0, 12) || "(empty)"} query=${url.search}`,
  );

  // Aborto/timeout (no hay token_ws válido).
  if (!tokenWs) {
    const ref = tbkToken;
    if (ref) {
      const aborted = await prisma.payment.findFirst({
        where: { providerRef: ref },
        select: { id: true, appointmentId: true, tenant: { select: { slug: true } } },
      });
      if (aborted) {
        await failPaymentAndReleaseSlot(aborted.id, aborted.appointmentId);
        return NextResponse.redirect(`${APP_URL}/reservar/${aborted.tenant.slug}`, 303);
      }
    }
    return NextResponse.redirect(`${APP_URL}/`, 303);
  }

  const payment = await prisma.payment.findFirst({
    where: { providerRef: tokenWs },
    include: { tenant: true },
  });
  if (!payment) {
    return NextResponse.redirect(`${APP_URL}/`, 303);
  }

  const ownToken = signPaymentToken(payment.id);

  // Idempotente: si ya estaba pagado, lleva a la confirmación (de ahí el
  // cliente entra a la gestión con un click).
  if (payment.status === "PAID") {
    return NextResponse.redirect(`${APP_URL}/pagar/${ownToken}`, 303);
  }

  if (payment.status !== "PENDING") {
    return NextResponse.redirect(`${APP_URL}/pagar/${ownToken}`, 303);
  }

  let result;
  try {
    result = await commitWebpayTransaction(tokenWs);
  } catch {
    await failPaymentAndReleaseSlot(payment.id, payment.appointmentId);
    return NextResponse.redirect(`${APP_URL}/pagar/${ownToken}`, 303);
  }

  if (result.response_code !== 0) {
    await failPaymentAndReleaseSlot(payment.id, payment.appointmentId);
    return NextResponse.redirect(`${APP_URL}/pagar/${ownToken}`, 303);
  }

  // OK: marca pago + confirma cita (atómico).
  const claimed = await prisma.$transaction(async (tx) => {
    const c = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (c.count === 0) return false;
    await tx.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: "SCHEDULED" },
    });
    return true;
  });

  if (claimed) {
    const apptFull = await prisma.appointment.findUnique({
      where: { id: payment.appointmentId },
      include: {
        barber: { include: { user: true } },
        client: true,
        services: { include: { service: true } },
      },
    });
    if (apptFull) {
      await notifyAppointment("confirmed", payment.tenant, apptFull).catch(() => undefined);
    }
  }

  // Lleva al cliente a /pagar/[token]: el branch PAID muestra "Pago confirmado"
  // con el resumen y un botón "Ver mi reserva" que abre la gestión.
  return NextResponse.redirect(`${APP_URL}/pagar/${ownToken}`, 303);
}

export const POST = handle;
// Transbank a veces usa GET en escenarios de error/abort según versión.
export const GET = handle;
