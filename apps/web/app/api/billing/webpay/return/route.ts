import { NextResponse } from "next/server";
import { prisma, Plan, SubscriptionStatus, BillingInterval } from "@navaxa/db";
import { commitWebpayTransaction } from "@/lib/webpay";
import { addMonths, isPaidPlan, isBillingInterval, periodMonths, signBillingToken } from "@/lib/billing";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Return URL de Webpay Plus para suscripciones SaaS. Esquema igual a deposits:
 * Transbank POST con `token_ws` (o `TBK_TOKEN` en abort/timeout). Codificamos
 * `session_id = "${tenantId}:${plan}"` en la creación para identificar a quién
 * activar al recibir el commit (Webpay devuelve session_id intacto).
 */
async function handle(req: Request): Promise<Response> {
  // Soporta POST (form-encoded) y GET (query string): Webpay alterna según flujo.
  const url = new URL(req.url);
  const form = req.method === "POST" ? await req.formData().catch(() => null) : null;
  const tokenWs = String(form?.get("token_ws") ?? url.searchParams.get("token_ws") ?? "");

  if (!tokenWs) {
    // Aborto o timeout: el dueño vuelve a la pantalla de planes.
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=plan`, 303);
  }

  let result;
  try {
    result = await commitWebpayTransaction(tokenWs);
  } catch {
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=plan&error=webpay`, 303);
  }

  if (result.response_code !== 0) {
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=plan&error=rechazado`, 303);
  }

  // session_id = `${tenantId}:${plan}:${interval}` (lo armamos en /facturar/[token]/page.tsx).
  const [tenantId, planStr, intervalStr] = (result.session_id ?? "").split(":");
  if (!tenantId || !isPaidPlan(planStr)) {
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=plan&error=session`, 303);
  }
  const plan = planStr as Plan;
  // Intervalo: si falta o es inválido (tokens viejos), cae a mensual.
  const interval: BillingInterval = isBillingInterval(intervalStr ?? "") ? (intervalStr as BillingInterval) : "MONTHLY";

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) {
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=plan&error=tenant`, 303);
  }

  const now = new Date();
  const periodEnd = addMonths(now, periodMonths(interval));

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        billingInterval: interval,
        lastPaymentAt: now,
        provider: "webpay",
        providerRef: tokenWs,
      },
      update: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        billingInterval: interval,
        lastPaymentAt: now,
        cancelAtPeriodEnd: false,
        provider: "webpay",
        providerRef: tokenWs,
      },
    }),
    prisma.tenant.update({ where: { id: tenantId }, data: { plan } }),
  ]);

  // Vuelve a /facturar/[token]?ok=1: la página renderiza el screen de éxito.
  // planStr ya pasó isPaidPlan, así que signBillingToken (que espera PaidPlan) compila.
  const billingToken = signBillingToken(tenantId, planStr, interval);
  return NextResponse.redirect(`${APP_URL}/facturar/${billingToken}?ok=1`, 303);
}

export const POST = handle;
export const GET = handle;
