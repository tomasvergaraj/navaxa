import { NextResponse } from "next/server";
import { prisma, Plan } from "@navaxa/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { isPaidPlan, signBillingToken, buildBillingCheckoutUrl } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Acciones de facturación del dueño:
 *  - checkout: inicia el cobro de un plan (devuelve checkoutUrl al mock).
 *  - cancel: cancela al final del período (mantiene acceso hasta entonces).
 *  - reactivate: deshace una cancelación pendiente.
 */
export async function POST(req: Request) {
  try {
    const { tenantId, role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Solo el dueño puede gestionar el plan" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string; plan?: string };

    if (body.action === "checkout") {
      const plan = body.plan ?? "";
      if (!isPaidPlan(plan)) {
        return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
      }
      const token = signBillingToken(tenantId, plan);
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
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
