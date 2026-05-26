import { Card } from "@navaxa/ui";
import { Star } from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/ui/stars";
import { EmptyState } from "@/components/empty-state";
import { HideReviewButton } from "@/components/reviews/hide-review-button";

export const dynamic = "force-dynamic";

export default async function ResenasPage() {
  const db = scopedDb();

  const [reviews, agg] = await Promise.all([
    db.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rating: true,
        comment: true,
        hidden: true,
        createdAt: true,
        client: { select: { firstName: true, lastName: true } },
        barber: { select: { user: { select: { name: true } } } },
      },
    }),
    db.review.aggregate({ where: { hidden: false }, _avg: { rating: true }, _count: true }),
  ]);

  const avg = agg._avg.rating ?? 0;
  const visibleCount = agg._count;

  return (
    <div className="container max-w-3xl py-8">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Reseñas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lo que opinan tus clientes tras cada visita. Puedes ocultar una del público.
          </p>
        </div>
        {visibleCount > 0 && (
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <Star className="h-5 w-5 fill-accent text-accent" />
              <span className="font-display text-2xl font-medium tabular-nums">{avg.toFixed(1)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {visibleCount} pública{visibleCount === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </header>

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Aún no hay reseñas"
          description="Cuando completes citas, tus clientes recibirán una invitación para reseñar y aparecerán aquí."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className={r.hidden ? "p-4 opacity-60" : "p-4"}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} size={15} />
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    {r.hidden && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Oculta
                      </span>
                    )}
                  </div>
                  {r.comment && <p className="mt-2 text-sm leading-relaxed">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.client.firstName} {r.client.lastName ?? ""} · con {r.barber.user.name}
                  </p>
                </div>
                <HideReviewButton id={r.id} hidden={r.hidden} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
