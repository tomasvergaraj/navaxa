import Link from "next/link";
import { Card } from "@navaxa/ui";
import { Lock } from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { getTenantPlan, planHasProducts } from "@/lib/plan-features";
import { PageHeader } from "@/components/page-header";
import { ProductsManager } from "@/components/products/products-manager";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const { tenantId } = requireManagerPage();
  const plan = await getTenantPlan(tenantId);

  if (!planHasProducts(plan)) {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader
          title="Productos"
          subtitle="Vende ceras, shampoo y accesorios con control de stock."
        />
        <Card className="flex flex-wrap items-center gap-3 border-dashed p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">
            El control de productos e inventario está disponible desde el plan Starter.
          </span>
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
  const products = await db.product.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 500,
  });

  return (
    <div className="container max-w-5xl py-8">
      <PageHeader
        title="Productos"
        subtitle="Inventario y precios de lo que vendes en el local."
      />
      <ProductsManager
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          cost: p.cost,
          stock: p.stock,
          minStock: p.minStock,
          active: p.active,
        }))}
      />
    </div>
  );
}
