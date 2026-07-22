import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Gift, Globe, Instagram, MapPin, Phone } from "lucide-react";
import { prisma } from "@navaxa/db";
import { resolveTenantBySlug, getPublicHours } from "@/lib/public-booking";
import { ServicesBrowser } from "@/components/booking/services-browser";
import { TenantAnalytics } from "@/components/booking/tenant-analytics";
import { brandStyle } from "@/lib/brand-color";
import { planHasBranding, planHasGiftCards } from "@/lib/plan-features";
import { HoursToggle } from "@/components/booking/hours-toggle";
import { Reveal } from "@/components/marketing/reveal";
import { WhatsappIcon } from "@/components/ui/whatsapp-icon";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Stars } from "@/components/ui/stars";
import { formatRelative } from "@/lib/format";
import type { GoogleReview } from "@/lib/google-reviews";

// ISR corto: esta página se comparte por WhatsApp y pagaba 6 queries por hit.
// Nada acá es per-request (sin cookies); 120s de staleness es aceptable.
export const revalidate = 120;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) return { title: "Reservar hora" };

  // Sin esto el preview heredaba el OG de navaxa: el dueño compartía su vitrina
  // por WhatsApp/Instagram y salía la marca del SaaS, no su barbería.
  const title = `Reservar hora · ${tenant.name}`;
  const description =
    tenant.description?.trim() ||
    `Reserva tu hora en ${tenant.name}${tenant.city ? ` · ${tenant.city}` : ""}.`;
  const image = tenant.coverUrl ?? tenant.logoUrl ?? undefined;

  return {
    // Indexable a propósito: es la vitrina pública del local (SEO local con
    // sus reseñas de Google). /agendar y /gestion siguen noindex.
    title,
    description,
    alternates: { canonical: `/reservar/${tenant.slug}` },
    openGraph: {
      title,
      description,
      url: `/reservar/${tenant.slug}`,
      siteName: tenant.name,
      locale: "es_CL",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? ("summary_large_image" as const) : ("summary" as const),
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ReservarPage({ params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) notFound();

  const [services, barbers, hours, reviewAgg, barberRatings, reviews] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true, description: true, durationMin: true, price: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.barber.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, avatarUrl: true, specialties: true, instagram: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getPublicHours(tenant.id),
    prisma.review.aggregate({
      where: { tenantId: tenant.id, hidden: false },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.groupBy({
      by: ["barberId"],
      where: { tenantId: tenant.id, hidden: false },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.findMany({
      where: { tenantId: tenant.id, hidden: false },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        client: { select: { firstName: true } },
        barber: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const ratingByBarber = new Map(
    barberRatings.map((r) => [r.barberId, { avg: r._avg.rating ?? 0, count: r._count }]),
  );

  const professionals = barbers.map((b) => ({
    id: b.id,
    name: b.user.name,
    avatarUrl: b.avatarUrl,
    instagramHref: b.instagram
      ? `https://instagram.com/${b.instagram.replace(/^@/, "")}`
      : null,
    rating: ratingByBarber.get(b.id) ?? null,
  }));

  const avgRating = reviewAgg._avg.rating ?? 0;
  const reviewCount = reviewAgg._count;

  // Cache de Google (refrescado a diario por cron; ver lib/google-reviews.ts).
  const googleRating = tenant.googleRating ?? 0;
  const googleCount = tenant.googleReviewCount ?? 0;
  const googleReviews = ((tenant.googleReviews ?? []) as unknown as GoogleReview[]).filter(
    (r) => r.text,
  );
  const writeReviewHref = tenant.googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(tenant.googlePlaceId)}`
    : null;
  // Una sola fuente de verdad pública: si el local está vinculado a Google,
  // se muestra SOLO el rating/reseñas de Google; lo interno queda de fallback.
  const googleLinked = Boolean(tenant.googlePlaceId) && googleRating > 0 && googleCount > 0;

  const fullAddress = [tenant.address, tenant.city].filter(Boolean).join(", ");
  const mapsQuery = fullAddress ? `${tenant.name} ${fullAddress}` : tenant.name;
  const mapsEmbed = `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const telHref = tenant.phone ? `tel:${tenant.phone.replace(/[^+\d]/g, "")}` : null;
  const waHref = tenant.phone ? `https://wa.me/${tenant.phone.replace(/[^\d]/g, "")}` : null;
  const igHref = tenant.instagram
    ? tenant.instagram.startsWith("http")
      ? tenant.instagram
      : `https://instagram.com/${tenant.instagram.replace(/^@/, "")}`
    : null;

  const pill =
    "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30";

  return (
    <div
      className="min-h-screen bg-muted/30"
      style={
        planHasBranding(tenant.plan)
          ? brandStyle(tenant.brandColor, tenant.brandAccentColor)
          : undefined
      }
    >
      <TenantAnalytics tenant={tenant} />

      {/* Sin barra con el nombre arriba: era el mismo dato que el <h1> de abajo. */}
      <main id="main" className="mx-auto max-w-4xl px-4 pb-14">
        {/* Portada: a sangre en móvil (sin marco, sin esquinas redondeadas y
            pegada al borde superior); tarjeta enmarcada desde sm. */}
        <div className="-mx-4 aspect-[16/5] animate-rise-blur overflow-hidden bg-muted sm:mx-0 sm:mt-6 sm:rounded-2xl sm:border sm:border-border">
          {tenant.coverUrl ? (
            // next/image: la portada full-res de R2 descargaba megas en 4G.
            <Image
              src={tenant.coverUrl}
              alt={tenant.name}
              width={1024}
              height={320}
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="h-full w-full object-cover transition-transform [transition-duration:1200ms] ease-out-quart hover:scale-[1.04] motion-reduce:transition-none"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-brand-graphite to-accent/30" />
          )}
        </div>

        {/* Identidad centrada (logo sobre la portada) */}
        <header className="flex flex-col items-center px-4 text-center">
          {tenant.logoUrl ? (
            <Image
              src={tenant.logoUrl}
              alt={tenant.name}
              width={96}
              height={96}
              sizes="96px"
              className="-mt-12 h-24 w-24 animate-settle rounded-2xl border-4 border-card bg-card object-cover shadow-sm"
              style={{ animationDelay: "120ms" }}
            />
          ) : (
            <div
              className="-mt-12 flex h-24 w-24 animate-settle items-center justify-center rounded-2xl border-4 border-card bg-accent/15 font-display text-4xl font-medium text-foreground shadow-sm"
              style={{ animationDelay: "120ms" }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}

          <h1
            className="mt-3 animate-rise font-display text-3xl font-medium tracking-tight"
            style={{ animationDelay: "220ms" }}
          >
            {tenant.name}
          </h1>

          {!googleLinked && reviewCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Stars value={avgRating} size={16} />
              <span className="font-medium tabular-nums">{avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                · {reviewCount} reseña{reviewCount === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {googleLinked && (
            <a
              href={tenant.googleMapsUri ?? mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span className="font-medium tabular-nums text-foreground">
                {googleRating.toFixed(1)}
              </span>
              <Stars value={googleRating} size={14} />
              <span>
                · {googleCount} reseña{googleCount === 1 ? "" : "s"} en Google
              </span>
            </a>
          )}

          {(igHref || tenant.website) && (
            <div className="mt-2 flex items-center gap-3">
              {igHref && (
                <a href={igHref} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="text-muted-foreground transition-colors hover:text-foreground">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {tenant.website && (
                <a href={tenant.website} target="_blank" rel="noopener noreferrer" aria-label="Sitio web"
                  className="text-muted-foreground transition-colors hover:text-foreground">
                  <Globe className="h-5 w-5" />
                </a>
              )}
            </div>
          )}

          {tenant.description && (
            <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {tenant.description}
            </p>
          )}

          {/* Contacto en píldoras */}
          <div
            className="mt-5 flex animate-rise flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: "320ms" }}
          >
            {fullAddress && (
              <a href={mapsLink} target="_blank" rel="noopener noreferrer" className={pill}>
                <MapPin className="h-4 w-4 shrink-0" />
                {tenant.city || "Ubicación"}
              </a>
            )}
            {tenant.phone && telHref && (
              <a href={telHref} className={pill}>
                <Phone className="h-4 w-4 shrink-0" />
                {tenant.phone}
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <WhatsappIcon className="h-4 w-4 shrink-0" />
                WhatsApp
              </a>
            )}
          </div>
        </header>

        {/* Equipo */}
        {professionals.length > 0 && (
          <Reveal as="section" className="mt-12">
            <h2 className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Nuestro equipo
            </h2>
            <div className="flex flex-wrap justify-center gap-6">
              {professionals.map((p) => (
                <div key={p.id} className="flex w-20 flex-col items-center text-center">
                  {p.avatarUrl ? (
                    <Image
                      src={p.avatarUrl}
                      alt={p.name}
                      width={64}
                      height={64}
                      sizes="64px"
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-graphite text-sm text-brand-ivory">
                      {p.name.split(" ").slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}
                    </div>
                  )}
                  <span className="mt-2 line-clamp-2 h-[28px] text-xs leading-tight text-muted-foreground">{p.name}</span>
                  {p.instagramHref ? (
                    <a
                      href={p.instagramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Instagram de ${p.name}`}
                      className="mt-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="mt-1 h-4" aria-hidden />
                  )}
                  {p.rating && p.rating.count > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Stars value={p.rating.avg} size={11} />
                      {p.rating.avg.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Servicios */}
        <Reveal as="section" id="servicios" className="mt-12 scroll-mt-20">
          <h2 className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Servicios
          </h2>
          <ServicesBrowser slug={tenant.slug} services={services} />
        </Reveal>

        {/* Giftcard (plan Pro): regalar es una segunda razón para entrar a la vitrina */}
        {planHasGiftCards(tenant.plan) && (
          <Reveal as="section" className="mt-12">
            <Link
              href={`/regalar/${tenant.slug}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50"
            >
              <Gift className="h-8 w-8 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-medium">Regala una giftcard</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Elige el monto y le llega un código por email para usar acá.
                </span>
              </span>
            </Link>
          </Reveal>
        )}

        {/* Reseñas internas: solo como fallback si el local no está vinculado a Google */}
        {!googleLinked && reviews.length > 0 && (
          <Reveal as="section" className="mt-12">
            <h2 className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Reseñas
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={r.rating} size={14} />
                    <span className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</span>
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">{r.comment}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.client.firstName} · con {r.barber.user.name}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Reseñas de Google (cache diario de Places API, con atribución) */}
        {googleReviews.length > 0 && (
          <Reveal as="section" className="mt-12">
            <h2 className="mb-5 flex items-center justify-center gap-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <GoogleIcon className="h-4 w-4" />
              Reseñas en Google
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {googleReviews.map((r, i) => (
                <div key={`${r.publishTime}-${i}`} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={r.rating} size={14} />
                    <span className="text-xs text-muted-foreground">{r.relativeTime}</span>
                  </div>
                  <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-foreground/90">
                    {r.text}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {r.avatarUrl && (
                      <Image
                        src={r.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded-full"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">{r.author} · en Google</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
              {tenant.googleMapsUri && (
                <a
                  href={tenant.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground underline transition-colors hover:text-foreground"
                >
                  Ver todas en Google
                </a>
              )}
              {writeReviewHref && (
                <a
                  href={writeReviewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground underline transition-colors hover:text-foreground"
                >
                  Escribir una reseña
                </a>
              )}
            </div>
          </Reveal>
        )}

        {/* Ubicación y horario */}
        {(fullAddress || hours.length > 0) && (
          <Reveal as="section" className="mt-12">
            <h2 className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cómo llegar
            </h2>
            <div className="grid gap-5 md:grid-cols-[1fr_280px]">
              {fullAddress ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <iframe
                    title="Mapa"
                    src={mapsEmbed}
                    className="h-56 w-full md:h-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <div />
              )}
              <div className="space-y-4 rounded-xl border border-border bg-card p-5 text-sm">
                {fullAddress && (
                  <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-muted-foreground transition-colors hover:text-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{fullAddress}</span>
                  </a>
                )}
                {tenant.phone && telHref && (
                  <a href={telHref} className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    {tenant.phone}
                  </a>
                )}
                {hours.length > 0 && <HoursToggle hours={hours} timezone={tenant.timezone ?? "America/Santiago"} />}
              </div>
            </div>
          </Reveal>
        )}
      </main>

      {/* CTA sticky (solo móvil): la conversión no debe depender de scrollear
          hasta la lista de servicios. */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <a
          href="#servicios"
          className="flex h-11 w-full items-center justify-center rounded-md bg-foreground text-sm font-medium text-background"
        >
          Reservar hora
        </a>
      </div>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Reservas con{" "}
        <Link href="/" className="font-medium text-foreground hover:underline">
          navaxa
        </Link>
      </footer>
    </div>
  );
}
