import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { apiError, requireManager } from "@/lib/api-errors";
import { verifyBillingToken, addMonths, periodMonths } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Confirma el pago de un plan (proveedor mock). Con una pasarela real, esto lo
 * dispararía su webhook. Activa la suscripción y sube el plan del tenant.
 * Requiere que el dueño autenticado coincida con el tenant del token.
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const { tenantId } = await requireManager();

    const parsed = verifyBillingToken(params.token);
    if (!parsed || parsed.tenantId !== tenantId) {
      return NextResponse.json({ error: "Enlace de pago inválido" }, { status: 400 });
    }

    const now = new Date();
    const periodEnd = addMonths(now, periodMonths(parsed.interval));

    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          plan: parsed.plan,
          status: "ACTIVE",
          currentPeriodEnd: periodEnd,
          billingInterval: parsed.interval,
          lastPaymentAt: now,
          provider: "mock",
          providerRef: `mock_sub_${tenantId}`,
        },
        update: {
          plan: parsed.plan,
          status: "ACTIVE",
          currentPeriodEnd: periodEnd,
          billingInterval: parsed.interval,
          lastPaymentAt: now,
          cancelAtPeriodEnd: false,
          provider: "mock",
          providerRef: `mock_sub_${tenantId}`,
        },
      }),
      prisma.tenant.update({ where: { id: tenantId }, data: { plan: parsed.plan } }),
    ]);

    return NextResponse.json({ ok: true, plan: parsed.plan });
  } catch (e) {
    return apiError(e);
  }
}
