import Link from "next/link";
import Image from "next/image";
import { MapPin, Search, Star, Scissors } from "lucide-react";
import { prisma } from "@navaxa/db";
import { Stars } from "@/components/ui/stars";

export const revalidate = 300; // ISR 5 min: directorio no cambia por request

const PAGE_SIZE = 24;

export const metadata = {
  title: "Reserva hora en barberías cerca de ti · navaxa",
  description:
    "Encuentra barberías y reserva tu hora online. Elige servicio, barbero y horario en segundos.",
  alternates: { canonical: "https://navaxa.cl/reservar" },
};

interface SP {
  q?: string;
  city?: string;
  page?: string;
}

export default async function MarketplacePage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q ?? "").trim();
  const city = (searchParams.city ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where = {
    active: true,
    bookingEnabled: true,
    marketplaceVisible: true,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
  };

  const [tenants, total, cityRows] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        slug: true,
        name: true,
        city: true,
        logoUrl: true,
        description: true,
        googleRating: true,
        googleReviewCount: true,
      },
      orderBy: [{ googleReviewCount: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.tenant.count({ where }),
    // Ciudades con al menos una barbería listada, para el filtro.
    prisma.tenant.findMany({
      where: { active: true, bookingEnabled: true, marketplaceVisible: true, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
      take: 100,
    }),
  ]);

  // Rating interno como respaldo del de Google (una sola query para la página).
  const slugs = tenants.map((t) => t.slug);
  const internal =
    slugs.length > 0
      ? await prisma.review.groupBy({
          by: ["tenantId"],
          where: { hidden: false, tenant: { slug: { in: slugs } } },
          _avg: { rating: true },
          _count: true,
        })
      : [];
  const tenantIdBySlug = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const slugById = new Map(tenantIdBySlug.map((t) => [t.id, t.slug]));
  const internalBySlug = new Map(
    internal.map((r) => [slugById.get(r.tenantId)!, { avg: r._avg.rating ?? 0, count: r._count }]),
  );

  const cities = cityRows.map((c) => c.city!).filter(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const cards = tenants.map((t) => {
    const gRating = t.googleRating ?? null;
    const gCount = t.googleReviewCount ?? 0;
    const int = internalBySlug.get(t.slug);
    const rating = gRating ?? (int && int.count > 0 ? int.avg : null);
    const count = gRating ? gCount : int?.count ?? 0;
    return { ...t, rating, count };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: cards.map((t, i) => ({
      "@type": "ListItem",
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: `https://navaxa.cl/reservar/${t.slug}`,
      name: t.name,
    })),
  };

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (city) sp.set("city", city);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/reservar?${s}` : "/reservar";
  };

  return (
    <div id="main" className="min-h-screen bg-muted/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-display text-lg font-medium tracking-tight">
            navaxa
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Soy barbería
          </Link>
        </div>
      </nav>

      <header className="mx-auto max-w-5xl px-4 pb-6 pt-10">
        <h1 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Reserva tu hora en la barbería que te queda mejor
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Elige servicio, barbero y horario en segundos. Sin llamadas ni esperas.
        </p>

        {/* Búsqueda + ciudad: form GET, funciona sin JS. */}
        <form className="mt-6 flex flex-wrap gap-2" action="/reservar">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre…"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {cities.length > 0 && (
            <select
              name="city"
              defaultValue={city}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todas las ciudades</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Buscar
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Scissors className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No encontramos barberías con esos filtros</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {q || city ? (
                <Link href="/reservar" className="underline hover:text-foreground">
                  Ver todas las barberías
                </Link>
              ) : (
                "Vuelve pronto: cada semana se suman más locales."
              )}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {total} barbería{total === 1 ? "" : "s"}
              {city ? ` en ${city}` : ""}
              {q ? ` · «${q}»` : ""}
            </p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/reservar/${t.slug}`}
                    className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20"
                  >
                    <div className="flex items-center gap-3">
                      {t.logoUrl ? (
                        <Image
                          src={t.logoUrl}
                          alt=""
                          width={48}
                          height={48}
                          sizes="48px"
                          className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-display text-xl font-medium">
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate font-medium group-hover:underline">{t.name}</h2>
                        {t.city && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {t.city}
                          </p>
                        )}
                      </div>
                    </div>

                    {t.rating != null && t.count > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm">
                        <Stars value={t.rating} />
                        <span className="font-medium tabular-nums">{t.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({t.count})</span>
                      </div>
                    )}

                    {t.description && (
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {t.description}
                      </p>
                    )}

                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                      Reservar
                      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
                {page > 1 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-md border border-input bg-background px-3 py-2 font-medium hover:bg-muted"
                  >
                    ← Anterior
                  </Link>
                ) : (
                  <span className="rounded-md border border-input px-3 py-2 text-muted-foreground opacity-50">
                    ← Anterior
                  </span>
                )}
                <span className="text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-md border border-input bg-background px-3 py-2 font-medium hover:bg-muted"
                  >
                    Siguiente →
                  </Link>
                ) : (
                  <span className="rounded-md border border-input px-3 py-2 text-muted-foreground opacity-50">
                    Siguiente →
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
