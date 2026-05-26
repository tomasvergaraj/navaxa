import { notFound } from "next/navigation";
import Link from "next/link";
import { Globe, Instagram, MapPin, Phone } from "lucide-react";
import { prisma } from "@navaxa/db";
import { resolveTenantBySlug, getPublicHours } from "@/lib/public-booking";
import { ServicesBrowser } from "@/components/booking/services-browser";
import { HoursToggle } from "@/components/booking/hours-toggle";
import { WhatsappIcon } from "@/components/ui/whatsapp-icon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  return {
    title: tenant ? `Reservar hora · ${tenant.name}` : "Reservar hora",
    robots: { index: false },
  };
}

export default async function ReservarPage({ params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) notFound();

  const [services, barbers, hours] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true, description: true, durationMin: true, price: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.barber.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, avatarUrl: true, specialties: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getPublicHours(tenant.id),
  ]);

  const professionals = barbers.map((b) => ({
    id: b.id,
    name: b.user.name,
    avatarUrl: b.avatarUrl,
  }));

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

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="font-display text-lg font-medium tracking-tight">{tenant.name}</span>
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Iniciar sesión
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna izquierda: portada + info */}
          <div className="space-y-4 lg:col-span-2">
            <div className="aspect-[5/2] w-full overflow-hidden rounded-xl border border-border bg-muted">
              {tenant.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.coverUrl} alt={tenant.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-brand-graphite to-accent/30" />
              )}
            </div>

            <div className="flex gap-4">
              {tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="-mt-10 h-20 w-20 shrink-0 rounded-2xl border-4 border-card bg-card object-cover shadow-sm"
                />
              ) : (
                <div className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-accent/15 font-display text-3xl font-medium text-accent-foreground shadow-sm">
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <h1 className="font-display text-2xl font-medium tracking-tight">{tenant.name}</h1>
                  <div className="flex items-center gap-2 pt-1">
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
                </div>
                {tenant.description && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {tenant.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha: mapa + contacto + horario + profesionales */}
          <aside className="space-y-5 rounded-xl border border-border bg-card p-4">
            {fullAddress && (
              <div className="overflow-hidden rounded-lg border border-border">
                <iframe
                  title="Mapa"
                  src={mapsEmbed}
                  className="h-40 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}

            <div className="space-y-3 text-sm">
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
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 font-medium text-foreground">
                  <WhatsappIcon className="h-4 w-4 shrink-0" />
                  Contáctanos por WhatsApp
                </a>
              )}
              {hours.length > 0 && <HoursToggle hours={hours} timezone={tenant.timezone ?? "America/Santiago"} />}
            </div>

            {professionals.length > 0 && (
              <div className="border-t border-border pt-4">
                <h2 className="mb-3 text-sm font-medium">Profesionales</h2>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {professionals.map((p) => (
                    <div key={p.id} className="flex w-16 shrink-0 flex-col items-center text-center">
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatarUrl} alt={p.name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-graphite text-xs text-brand-ivory">
                          {p.name.split(" ").slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}
                        </div>
                      )}
                      <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-8">
          <ServicesBrowser slug={tenant.slug} services={services} />
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Reservas con <span className="font-medium text-foreground">navaxa</span>
      </footer>
    </div>
  );
}
