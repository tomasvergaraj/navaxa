import Link from "next/link";
import { Card } from "@navaxa/ui";
import { Lock } from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { getTenantPlan, planHasGiftCards } from "@/lib/plan-features";
import { PageHeader } from "@/components/page-header";
import { GiftCardsManager } from "@/components/giftcards/giftcards-manager";

export const dynamic = "force-dynamic";

export default async function GiftcardsPage() {
  const { tenantId } = requireManagerPage();
  const plan = await getTenantPlan(tenantId);

  if (!planHasGiftCards(plan)) {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader
          title="Giftcards"
          subtitle="Vende saldo por adelantado y fideliza a tus clientes."
        />
        <Card className="flex flex-wrap items-center gap-3 border-dashed p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">Las giftcards están disponibles en el plan Pro.</span>
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
  const [cards, agg] = await Promise.all([
    db.giftCard.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    db.giftCard.aggregate({
      where: { status: "ACTIVE" },
      _sum: { balance: true },
      _count: true,
    }),
  ]);

  return (
    <div className="container max-w-5xl py-8">
      <PageHeader
        title="Giftcards"
        subtitle="Emite giftcards, consúltalas y canjéalas en el mostrador."
      />
      <GiftCardsManager
        cards={cards.map((c) => ({
          id: c.id,
          code: c.code,
          initialValue: c.initialValue,
          balance: c.balance,
          status: c.status,
          buyerName: c.buyerName,
          recipientName: c.recipientName,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
          createdAt: c.createdAt.toISOString(),
        }))}
        outstanding={{ balance: agg._sum.balance ?? 0, count: agg._count }}
      />
    </div>
  );
}
