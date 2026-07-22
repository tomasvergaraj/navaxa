import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { commitWebpayTransaction } from "@/lib/webpay";
import {
  confirmAppointmentCharge,
  failAppointmentCharge,
  signAppointmentChargeToken,
} from "@/lib/appointment-charge-links";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Return URL de Webpay Plus para el pago del saldo de una cita. Mismos cuatro
 * casos que los otros dos returns (ver app/api/public/webpay/return/route.ts):
 * pago OK, rechazo, abort y timeout; los dos últimos llegan con `TBK_TOKEN` y
 * sin `token_ws`.
 *
 * Acá no hay hora que liberar ni giftcard que emitir: un cobro fallido solo
 * queda FAILED y la deuda sigue viva para cobrarla de otra forma.
 */
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const form = req.method === "POST" ? await req.formData().catch(() => null) : null;
  const pick = (k: string) => String(form?.get(k) ?? url.searchParams.get(k) ?? "");
  const tokenWs = pick("token_ws");
  const tbkToken = pick("TBK_TOKEN");
  console.log(
    `[webpay/appointment-return] method=${req.method} tokenWs=${tokenWs.slice(0, 12) || "(empty)"} tbk=${tbkToken.slice(0, 12) || "(empty)"} query=${url.search}`,
  );

  // Aborto/timeout: no hay token_ws que commitear.
  if (!tokenWs) {
    if (tbkToken) {
      const aborted = await prisma.appointmentCharge.findFirst({
        where: { providerRef: tbkToken },
        select: { id: true },
      });
      if (aborted) {
        await failAppointmentCharge(aborted.id);
        return NextResponse.redirect(
          `${APP_URL}/pagar/cita/${signAppointmentChargeToken(aborted.id)}`,
          303,
        );
      }
    }
    return NextResponse.redirect(`${APP_URL}/`, 303);
  }

  const charge = await prisma.appointmentCharge.findFirst({ where: { providerRef: tokenWs } });
  if (!charge) return NextResponse.redirect(`${APP_URL}/`, 303);

  const back = `${APP_URL}/pagar/cita/${signAppointmentChargeToken(charge.id)}`;

  // Idempotente: un segundo return sobre un cobro ya cerrado solo muestra el estado.
  if (charge.status !== "PENDING") return NextResponse.redirect(back, 303);

  let result;
  try {
    result = await commitWebpayTransaction(tokenWs);
  } catch {
    await failAppointmentCharge(charge.id);
    return NextResponse.redirect(back, 303);
  }

  if (result.response_code !== 0) {
    await failAppointmentCharge(charge.id);
    return NextResponse.redirect(back, 303);
  }

  // Reconciliación de monto: no damos por pagada una deuda por un monto distinto
  // al que efectivamente cobró la pasarela.
  if (result.amount !== charge.amount) {
    console.warn(
      `[webpay/appointment-return] monto descalzado charge=${charge.id} esperado=${charge.amount} cobrado=${result.amount}`,
    );
    await failAppointmentCharge(charge.id);
    return NextResponse.redirect(back, 303);
  }

  await confirmAppointmentCharge(charge.id, { authorizationCode: result.authorization_code });
  return NextResponse.redirect(back, 303);
}

export const POST = handle;
// Transbank a veces usa GET en escenarios de error/abort según versión.
export const GET = handle;
