import { Card } from "@navaxa/ui";
import { Download, DollarSign, Scissors, Receipt, UserX, UserPlus, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { StatsCard } from "@/components/stats-card";
import { PageHeader } from "@/components/page-header";
import { formatCLP } from "@/lib/format";
import { parsePeriod, bucketRevenue, formatPeriodRange } from "@/lib/reports";
import { computeOccupancy, formatMinutes } from "@/lib/occupancy";
import { PeriodSelector } from "@/components/reports/period-selector";
import { BarChart } from "@/components/reports/bar-chart";
import {
  OccupancyBarList,
  OccupancyHeatmap,
  OccupancyUpsell,
} from "@/components/reports/occupancy";

/** Estados que ocupan un bloque de agenda (excluye canceladas, no-show y pago pendiente). */
const OCCUPYING_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

export const dynamic = "force-dynamic";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const period = parsePeriod(searchParams);
  const { tenantId } = await requireManagerPage();
  const db = scopedDb();
  const range = { gte: period.from, lte: period.to };

  const [
    completed,
    statusCounts,
    newClients,
    byBarberRows,
    barbers,
    byServiceRows,
    services,
    occupying,
    tenantPlan,
    salesAgg,
  ] = await Promise.all([
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
      select: {
        id: true,
        commissionRate: true,
        active: true,
        user: { select: { name: true } },
        // Horario y bloqueos para la ocupación (BarberSchedule/TimeOff no
        // llevan tenantId propio: se leen vía la relación con Barber).
        schedule: { select: { weekday: true, startMin: true, endMin: true } },
        timeOff: {
          where: { startsAt: { lte: period.to }, endsAt: { gte: period.from } },
          select: { startsAt: true, endsAt: true },
        },
      },
    }),
    db.appointmentService.groupBy({
      by: ["serviceId"],
      where: { appointment: { tenantId, status: AppointmentStatus.COMPLETED, startsAt: range } },
      _sum: { priceCharged: true },
      _count: true,
    }),
    db.service.findMany({ select: { id: true, name: true, category: true } }),
    db.appointment.findMany({
      where: { status: { in: OCCUPYING_STATUSES }, startsAt: range },
      select: { barberId: true, startsAt: true, endsAt: true },
      take: 20000,
    }),
    // Tenant no lleva columna tenantId → prisma directo, no scopedDb.
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }),
    // Ventas de caja del período (las anuladas no cuentan).
    db.sale.aggregate({
      where: { createdAt: range, cancelledAt: null },
      _sum: { total: true },
      _count: true,
    }),
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

  // Ocupación: solo barberos activos (los inactivos no aportan capacidad).
  const activeBarbers = barbers.filter((b) => b.active);
  const occupancy = computeOccupancy({
    barbers: activeBarbers.map((b) => ({ id: b.id, name: b.user.name })),
    schedules: activeBarbers.flatMap((b) => b.schedule.map((s) => ({ ...s, barberId: b.id }))),
    timeOff: activeBarbers.flatMap((b) => b.timeOff.map((t) => ({ ...t, barberId: b.id }))),
    appointments: occupying,
    from: period.from,
    to: period.to,
  });
  // Desglose por barbero + mapa de horas: reportes avanzados (plan PRO+).
  const advancedReports = tenantPlan?.plan === "PRO" || tenantPlan?.plan === "ENTERPRISE";

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard label="Ingresos servicios" value={formatCLP(revenue)} icon={DollarSign} />
        <StatsCard
          label="Ventas caja"
          value={formatCLP(salesAgg._sum.total ?? 0)}
          trend={salesAgg._count > 0 ? { value: `${salesAgg._count} venta${salesAgg._count === 1 ? "" : "s"}`, positive: true } : undefined}
          icon={ShoppingBag}
        />
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

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">
            Ocupación{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · agenda reservada vs. horario de atención
            </span>
          </h2>
          {occupancy.pct !== null && (
            <span
              className="text-sm text-muted-foreground"
              title={`${formatMinutes(occupancy.bookedMin)} reservadas de ${formatMinutes(occupancy.capacityMin)} disponibles`}
            >
              Total{" "}
              <span className="font-medium tabular-nums text-foreground">
                {Math.round(occupancy.pct * 100)}%
              </span>
            </span>
          )}
        </div>
        {occupancy.pct === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Define los horarios de tu equipo en Configuración → Horarios para medir la ocupación.
          </p>
        ) : !advancedReports ? (
          <OccupancyUpsell />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Por barbero
              </h3>
              <OccupancyBarList rows={occupancy.byBarber} />
            </div>
            {occupancy.heatmap && (
              <div className="min-w-0">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mapa de horas
                </h3>
                <OccupancyHeatmap heatmap={occupancy.heatmap} />
              </div>
            )}
          </div>
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
