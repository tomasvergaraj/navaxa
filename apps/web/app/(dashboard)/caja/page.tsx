import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@navaxa/ui";
import { Lock } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { scopedDb } from "@/lib/tenant";
import { viewerScope } from "@/lib/page-guards";
import { getTenantPlan, planHasProducts, planHasGiftCards } from "@/lib/plan-features";
import { PageHeader } from "@/components/page-header";
import { CashRegister } from "@/components/sales/cash-register";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  // Gestión y recepción operan caja; un barbero no (solo agenda propia).
  const { ctx, isManager, ownOnly } = await viewerScope();
  if (ownOnly) redirect("/dashboard");

  const plan = await getTenantPlan(ctx.tenantId);
  if (!planHasProducts(plan)) {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader
          title="Caja"
          subtitle="Registra ventas de productos y servicios sueltos."
        />
        <Card className="flex flex-wrap items-center gap-3 border-dashed p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">La caja está disponible desde el plan Starter.</span>
          <Link
            href="/configuracion?tab=plan"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Ver planes
          </Link>
        </Card>
      </div>
    );
  }

  const db = scopedDb();
  const now = new Date();
  const [products, services, sales, barbers] = await Promise.all([
    db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, stock: true },
      take: 500,
    }),
    db.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
      take: 200,
    }),
    db.sale.findMany({
      where: { createdAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        items: { select: { name: true, qty: true, unitPrice: true } },
        client: { select: { firstName: true, lastName: true } },
        giftCard: { select: { code: true } },
      },
    }),
    db.barber.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="container max-w-6xl py-8">
      <PageHeader
        title="Caja"
        subtitle="Venta rápida de productos y servicios, y el resumen del día."
      />
      <CashRegister
        products={products}
        services={services}
        barbers={barbers.map((b) => ({ id: b.id, name: b.user.name }))}
        isManager={isManager}
        giftCardsEnabled={planHasGiftCards(plan)}
        initialSales={sales.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          total: s.total,
          paymentMethod: s.paymentMethod,
          giftCardAmount: s.giftCardAmount,
          giftCardCode: s.giftCard?.code ?? null,
          cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
          clientName: s.client ? `${s.client.firstName} ${s.client.lastName ?? ""}`.trim() : null,
          items: s.items,
        }))}
      />
    </div>
  );
}
