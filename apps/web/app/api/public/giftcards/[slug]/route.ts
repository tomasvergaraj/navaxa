import { NextResponse } from "next/server";
import { resolveTenantBySlug } from "@/lib/public-booking";
import { planHasGiftCards } from "@/lib/plan-features";
import { giftCardPurchaseSchema } from "@/lib/validators";
import { createGiftCardOrder } from "@/lib/giftcard-orders";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/** Vigencia de una giftcard comprada online, en meses. */
const PUBLIC_GIFTCARD_MONTHS = 12;

/**
 * Compra pública de giftcard. Crea la orden PENDING y la transacción en la
 * pasarela; devuelve la URL del checkout propio. La giftcard NO se emite acá:
 * eso ocurre en el return de Webpay, tras confirmar el cobro.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const ip = clientIp(req);
    // Cada intento crea una fila y pega contra Transbank: límite apretado.
    const limit = rateLimit(`gcorder:${ip}`, 5, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const tenant = await resolveTenantBySlug(params.slug);
    if (!tenant) return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });
    if (!planHasGiftCards(tenant.plan)) {
      return NextResponse.json({ error: "Esta barbería no vende giftcards" }, { status: 404 });
    }

    const parsed = giftCardPurchaseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    if (!(await verifyTurnstile(d.captchaToken, ip))) {
      return NextResponse.json({ error: "Verificación anti-bot fallida" }, { status: 400 });
    }

    const { token } = await createGiftCardOrder({
      tenantId: tenant.id,
      amount: d.amount,
      buyerName: d.buyerName,
      buyerEmail: d.buyerEmail,
      recipientName: d.recipientName,
      recipientEmail: d.recipientEmail || undefined,
      message: d.message,
      expiresInMonths: PUBLIC_GIFTCARD_MONTHS,
    });

    return NextResponse.json({ ok: true, url: `/regalar/orden/${token}` }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
