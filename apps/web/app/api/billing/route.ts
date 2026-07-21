import { NextResponse } from "next/server";
import { prisma, Plan } from "@navaxa/db";
import { apiError, requireManager } from "@/lib/api-errors";
import { isPaidPlan, isBillingInterval, signBillingToken, buildBillingCheckoutUrl } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Acciones de facturación del dueño:
 *  - checkout: inicia el cobro de un plan (devuelve checkoutUrl al mock).
 *  - cancel: cancela al final del período (mantiene acceso hasta entonces).
 *  - reactivate: deshace una cancelación pendiente.
 */
export async function POST(req: Request) {
  try {
    const { tenantId } = await requireManager();

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      plan?: string;
      interval?: string;
    };

    if (body.action === "checkout") {
      const plan = body.plan ?? "";
      if (!isPaidPlan(plan)) {
        return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
      }
      const interval = isBillingInterval(body.interval ?? "") ? (body.interval as "MONTHLY" | "ANNUAL") : "MONTHLY";
      const token = signBillingToken(tenantId, plan, interval);
      return NextResponse.json({ checkoutUrl: buildBillingCheckoutUrl(token) });
    }

    if (body.action === "cancel") {
      const sub = await prisma.subscription.findUnique({ where: { tenantId } });
      // Con período vigente: cancelar al final. Sin período: bajar a FREE ya.
      if (sub && sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
        await prisma.subscription.update({
          where: { tenantId },
          data: { cancelAtPeriodEnd: true },
        });
        return NextResponse.json({ ok: true, cancelAtPeriodEnd: true });
      }
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { tenantId },
          create: { tenantId, plan: Plan.FREE, status: "CANCELED" },
          update: { plan: Plan.FREE, status: "CANCELED", cancelAtPeriodEnd: false, currentPeriodEnd: null },
        }),
        prisma.tenant.update({ where: { id: tenantId }, data: { plan: Plan.FREE } }),
      ]);
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: false });
    }

    if (body.action === "reactivate") {
      await prisma.subscription.updateMany({
        where: { tenantId, cancelAtPeriodEnd: true },
        data: { cancelAtPeriodEnd: false },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
