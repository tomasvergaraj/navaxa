import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { prisma } from "@navaxa/db";
import { resolveTenantBySlug } from "@/lib/public-booking";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { TenantAnalytics } from "@/components/booking/tenant-analytics";
import { brandStyle } from "@/lib/brand-color";
import { planHasBranding } from "@/lib/plan-features";
import { formatCLP, formatDuration } from "@/lib/format";
import { turnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  return {
    title: tenant ? `Agendar · ${tenant.name}` : "Agendar",
    robots: { index: false },
  };
}

export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { service?: string };
}) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) notFound();

  const serviceId = searchParams.service;
  if (!serviceId) redirect(`/reservar/${tenant.slug}`);

  const service = await prisma.service.findFirst({
    where: { id: serviceId, tenantId: tenant.id, active: true },
    select: { id: true, name: true, durationMin: true, price: true },
  });
  if (!service) redirect(`/reservar/${tenant.slug}`);

  // Catálogo resuelto en el server: el wizard antes re-fetcheaba /services y
  // /barbers al montar (spinner extra antes de poder elegir barbero).
  const [services, barbersRaw] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true, description: true, durationMin: true, price: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.barber.findMany({
      where: { tenantId: tenant.id, active: true },
      select: {
        id: true,
        avatarUrl: true,
        specialties: true,
        user: { select: { name: true } },
        schedule: { select: { weekday: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const barbers = barbersRaw.map((b) => ({
    id: b.id,
    name: b.user.name,
    avatarUrl: b.avatarUrl,
    specialties: b.specialties,
  }));
  // Días de la semana en que cada barbero atiende: el wizard atenúa los días
  // sin horario para que el cliente no tapee a ciegas ("No hay horas ese día").
  const weekdaysByBarber: Record<string, number[]> = {};
  for (const b of barbersRaw) {
    weekdaysByBarber[b.id] = [...new Set(b.schedule.map((sc) => sc.weekday))];
  }

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
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link
            href={`/reservar/${tenant.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {tenant.name}
          </Link>
        </div>
      </nav>

      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Servicio</p>
          <h1 className="mt-1 font-display text-xl font-medium tracking-tight">{service.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(service.durationMin)}
            <span className="mx-1">·</span>
            <span className="font-medium text-foreground">{formatCLP(service.price)}</span>
          </p>
        </div>

        <BookingWizard
          slug={tenant.slug}
          currency={tenant.currency}
          timezone={tenant.timezone ?? "America/Santiago"}
          presetServiceId={service.id}
          initialServices={services}
          initialBarbers={barbers}
          weekdaysByBarber={weekdaysByBarber}
          turnstileSiteKey={turnstileSiteKey()}
          deposit={
            tenant.paymentsEnabled && tenant.depositType !== "NONE"
              ? { type: tenant.depositType, value: tenant.depositValue }
              : null
          }
        />
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Reservas con <span className="font-medium text-foreground">navaxa</span>
      </footer>
    </div>
  );
}
