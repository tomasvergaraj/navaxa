import { Card } from "@navaxa/ui";
import { Download, DollarSign, Scissors, Receipt, UserX, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { AppointmentStatus } from "@navaxa/db";
import { StatsCard } from "@/components/stats-card";
import { PageHeader } from "@/components/page-header";
import { formatCLP } from "@/lib/format";
import { parsePeriod, bucketRevenue, formatPeriodRange } from "@/lib/reports";
import { PeriodSelector } from "@/components/reports/period-selector";
import { BarChart } from "@/components/reports/bar-chart";

export const dynamic = "force-dynamic";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const period = parsePeriod(searchParams);
  const { tenantId } = requireManagerPage();
  const db = scopedDb();
  const range = { gte: period.from, lte: period.to };

  const [completed, statusCounts, newClients, byBarberRows, barbers, byServiceRows, services] =
    await Promise.all([
      db.appointment.findMany({
        where: { status: AppointmentStatus.COMPLETED, startsAt: range },
        select: { startsAt: true, totalPrice: true },
        // Tope de seguridad (regla COSTS.md): el rango ya está acotado a 366
        // días, esto protege ante volúmenes anómalos.
        take: 20000,
      }),
      db.appointment.groupBy({
        by: ["status"],
        where: { startsAt: range },
        _count: true,
      }),
      db.client.count({ where: { createdAt: range } }),
      db.appointment.groupBy({
        by: ["barberId"],
        where: { status: AppointmentStatus.COMPLETED, startsAt: range },
        _sum: { totalPrice: true },
        _count: true,
      }),
      db.barber.findMany({
        select: { id: true, commissionRate: true, user: { select: { name: true } } },
      }),
      db.appointmentService.groupBy({
        by: ["serviceId"],
        where: { appointment: { tenantId, status: AppointmentStatus.COMPLETED, startsAt: range } },
        _sum: { priceCharged: true },
        _count: true,
      }),
      db.service.findMany({ select: { id: true, name: true, category: true } }),
    ]);

  const revenue = completed.reduce((s, a) => s + a.totalPrice, 0);
  const completedCount = completed.length;
  const avgTicket = completedCount ? Math.round(revenue / completedCount) : 0;
  const noShows = statusCounts.find((s) => s.status === AppointmentStatus.NO_SHOW)?._count ?? 0;

  const chart = bucketRevenue(completed, period);

  const barberName = new Map(barbers.map((b) => [b.id, b.user.name]));
  const barberRate = new Map(barbers.map((b) => [b.id, b.commissionRate]));
  const byBarber = byBarberRows
    .map((r) => {
      const rev = r._sum.totalPrice ?? 0;
      return {
        id: r.barberId,
        name: barberName.get(r.barberId) ?? "Barbero",
        count: r._count,
        revenue: rev,
        avgTicket: r._count ? Math.round(rev / r._count) : 0,
        commission: Math.round(rev * (barberRate.get(r.barberId) ?? 0)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const serviceInfo = new Map(services.map((s) => [s.id, s]));
  const byService = byServiceRows
    .map((r) => ({
      id: r.serviceId,
      name: serviceInfo.get(r.serviceId)?.name ?? "Servicio",
      category: serviceInfo.get(r.serviceId)?.category ?? null,
      count: r._count,
      revenue: r._sum.priceCharged ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const exportParams = new URLSearchParams(
    searchParams.from && searchParams.to
      ? { from: searchParams.from, to: searchParams.to }
      : { range: period.rangeKey === "custom" ? "30d" : period.rangeKey },
  );

  return (
    <div className="container max-w-6xl py-8">
      <PageHeader
        title="Reportes"
        subtitle={formatPeriodRange(period)}
        action={
          <a
            href={`/api/reports/export?${exportParams.toString()}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        }
      />

      <div className="mb-6">
        <PeriodSelector
          rangeKey={period.rangeKey}
          from={format(period.from, "yyyy-MM-dd")}
          to={format(period.to, "yyyy-MM-dd")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatsCard label="Ingresos" value={formatCLP(revenue)} icon={DollarSign} />
        <StatsCard label="Cortes" value={String(completedCount)} icon={Scissors} />
        <StatsCard label="Ticket promedio" value={formatCLP(avgTicket)} icon={Receipt} />
        <StatsCard label="No-shows" value={String(noShows)} icon={UserX} />
        <StatsCard label="Clientes nuevos" value={String(newClients)} icon={UserPlus} />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-medium">
          Ingresos en el tiempo{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · por {period.bucket === "day" ? "día" : period.bucket === "week" ? "semana" : "mes"}
          </span>
        </h2>
        {revenue > 0 ? (
          <BarChart points={chart} />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Sin ingresos en este período.
          </p>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="font-medium">Por barbero</h2>
          </div>
          {byBarber.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {byBarber.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.count} cortes · ticket {formatCLP(b.avgTicket)} · comisión{" "}
                      {formatCLP(b.commission)}
                    </div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatCLP(b.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="font-medium">Por servicio</h2>
          </div>
          {byService.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {byService.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.count} vendido{s.count === 1 ? "" : "s"}
                      {s.category ? ` · ${s.category}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatCLP(s.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
