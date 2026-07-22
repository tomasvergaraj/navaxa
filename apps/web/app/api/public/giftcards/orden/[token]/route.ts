import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import {
  confirmGiftCardOrder,
  failGiftCardOrder,
  giftCardOrderProvider,
  verifyGiftCardOrderToken,
} from "@/lib/giftcard-orders";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Confirma la compra de giftcard del proveedor MOCK (botón "Pagar" del checkout
 * simulado en dev). Con Webpay la confirmación llega EXCLUSIVAMENTE por su
 * return handler tras `commitWebpayTransaction`; si no se gatea acá, cualquiera
 * se emite una giftcard con saldo real sin pagar. Chequeamos el provider
 * persistido y el activo, para que un valor viejo en la fila no reabra el hueco.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const limit = rateLimit(`gcorder-confirm:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const orderId = verifyGiftCardOrderToken(params.token);
    if (!orderId) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    const order = await prisma.giftCardOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, provider: true, expiresAt: true },
    });
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    if (order.status === "PAID") return NextResponse.json({ ok: true });
    if (order.status !== "PENDING") {
      return NextResponse.json({ error: "Esta compra ya no está vigente" }, { status: 409 });
    }

    if (order.provider !== "mock" || giftCardOrderProvider() !== "mock") {
      return NextResponse.json({ error: "Esta compra se confirma en la pasarela." }, { status: 409 });
    }

    if (order.expiresAt < new Date()) {
      await failGiftCardOrder(order.id, "EXPIRED");
      return NextResponse.json({ error: "El tiempo para pagar expiró." }, { status: 410 });
    }

    await confirmGiftCardOrder(order.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
