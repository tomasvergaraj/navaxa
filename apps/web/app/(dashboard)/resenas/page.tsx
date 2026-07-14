import Link from "next/link";
import { prisma } from "@navaxa/db";
import { Card } from "@navaxa/ui";
import { Star, ExternalLink } from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/ui/stars";
import { GoogleIcon } from "@/components/ui/google-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { HideReviewButton } from "@/components/reviews/hide-review-button";
import type { GoogleReview } from "@/lib/google-reviews";

export const dynamic = "force-dynamic";

export default async function ResenasPage() {
  const { tenantId } = requireManagerPage();
  const db = scopedDb();

  const [tenant, reviews, agg] = await Promise.all([
    // Tenant no lleva tenantId → prisma directo, no scopedDb.
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        googlePlaceId: true,
        googlePlaceName: true,
        googleRating: true,
        googleReviewCount: true,
        googleReviews: true,
        googleMapsUri: true,
        googleSyncedAt: true,
      },
    }),
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
  const googleReviews = ((tenant?.googleReviews ?? []) as unknown as GoogleReview[]).filter(
    (r) => r.text,
  );
  const writeReviewHref = tenant?.googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(tenant.googlePlaceId)}`
    : null;

  return (
    <div className="container max-w-3xl py-8">
      <PageHeader
        title="Reseñas"
        subtitle="Tu reputación en Google y el feedback privado que dejan tus clientes tras cada visita."
      />

      {/* Google: la fuente de verdad pública */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <GoogleIcon className="h-4 w-4" />
          Google
        </h2>
        {!tenant?.googlePlaceId ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Vincula tu local de Google Maps en{" "}
            <Link href="/configuracion" className="underline hover:text-foreground">
              Configuración &gt; Barbería
            </Link>{" "}
            para ver acá tu puntuación y reseñas de Google.
          </Card>
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{tenant.googlePlaceName ?? "Tu local en Google"}</p>
                {tenant.googleRating != null ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-display text-2xl font-medium tabular-nums">
                      {tenant.googleRating.toFixed(1)}
                    </span>
                    <Stars value={tenant.googleRating} size={15} />
                    <span className="text-xs text-muted-foreground">
                      {tenant.googleReviewCount ?? 0} reseñas
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aún sin datos — se sincroniza una vez al día.
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                {tenant.googleMapsUri && (
                  <a
                    href={tenant.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground underline hover:text-foreground"
                  >
                    Ver en Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {writeReviewHref && (
                  <a
                    href={writeReviewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground underline hover:text-foreground"
                  >
                    Link para pedir reseñas <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {tenant.googleSyncedAt && (
                  <span className="text-muted-foreground/70">
                    Actualizado {formatDate(tenant.googleSyncedAt)}
                  </span>
                )}
              </div>
            </div>

            {googleReviews.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {googleReviews.map((r, i) => (
                  <div key={`${r.publishTime}-${i}`}>
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} size={13} />
                      <span className="text-xs text-muted-foreground">
                        {r.author} · {r.relativeTime}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground/90">
                      {r.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </section>

      {/* Feedback interno post-visita (privado; alimenta la IA y tu gestión) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Feedback de clientes</h2>
          {visibleCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="font-medium tabular-nums">{avg.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">
                · {visibleCount} pública{visibleCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Aún no hay feedback"
            description="Cuando completes citas, tus clientes recibirán una única invitación para calificar su visita (y su corte, si subiste la foto)."
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
      </section>
    </div>
  );
}
