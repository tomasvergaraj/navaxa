import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { commitWebpayTransaction } from "@/lib/webpay";
import {
  confirmGiftCardOrder,
  failGiftCardOrder,
  signGiftCardOrderToken,
} from "@/lib/giftcard-orders";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Return URL de Webpay Plus para la compra pública de giftcards. Mismos cuatro
 * casos que el return de abonos (ver app/api/public/webpay/return/route.ts):
 * pago OK, rechazo, abort y timeout; los dos últimos llegan con `TBK_TOKEN` y
 * sin `token_ws`.
 *
 * Diferencia clave con los abonos: acá no hay hora que liberar. Una orden que
 * falla simplemente queda FAILED y no emite giftcard.
 */
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const form = req.method === "POST" ? await req.formData().catch(() => null) : null;
  const pick = (k: string) => String(form?.get(k) ?? url.searchParams.get(k) ?? "");
  const tokenWs = pick("token_ws");
  const tbkToken = pick("TBK_TOKEN");
  console.log(
    `[webpay/giftcard-return] method=${req.method} tokenWs=${tokenWs.slice(0, 12) || "(empty)"} tbk=${tbkToken.slice(0, 12) || "(empty)"} query=${url.search}`,
  );

  // Aborto/timeout: no hay token_ws que commitear.
  if (!tokenWs) {
    if (tbkToken) {
      const aborted = await prisma.giftCardOrder.findFirst({
        where: { providerRef: tbkToken },
        select: { id: true, tenant: { select: { slug: true } } },
      });
      if (aborted) {
        await failGiftCardOrder(aborted.id);
        return NextResponse.redirect(
          `${APP_URL}/regalar/${aborted.tenant.slug}?cancelado=1`,
          303,
        );
      }
    }
    return NextResponse.redirect(`${APP_URL}/`, 303);
  }

  const order = await prisma.giftCardOrder.findFirst({ where: { providerRef: tokenWs } });
  if (!order) return NextResponse.redirect(`${APP_URL}/`, 303);

  const ownToken = signGiftCardOrderToken(order.id);
  const back = `${APP_URL}/regalar/orden/${ownToken}`;

  // Idempotente: un segundo return sobre una orden ya cerrada solo muestra el estado.
  if (order.status !== "PENDING") return NextResponse.redirect(back, 303);

  let result;
  try {
    result = await commitWebpayTransaction(tokenWs);
  } catch {
    await failGiftCardOrder(order.id);
    return NextResponse.redirect(back, 303);
  }

  if (result.response_code !== 0) {
    await failGiftCardOrder(order.id);
    return NextResponse.redirect(back, 303);
  }

  // Reconciliación de monto: no emitimos saldo por un monto distinto al cobrado.
  if (result.amount !== order.amount) {
    console.warn(
      `[webpay/giftcard-return] monto descalzado order=${order.id} esperado=${order.amount} cobrado=${result.amount}`,
    );
    await failGiftCardOrder(order.id);
    return NextResponse.redirect(back, 303);
  }

  await confirmGiftCardOrder(order.id);
  return NextResponse.redirect(back, 303);
}

export const POST = handle;
// Transbank a veces usa GET en escenarios de error/abort según versión.
export const GET = handle;
