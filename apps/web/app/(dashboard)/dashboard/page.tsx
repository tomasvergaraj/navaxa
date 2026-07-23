import Link from "next/link";
import { Card, Badge } from "@navaxa/ui";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import { viewerScope } from "@/lib/page-guards";
import { auth } from "@/lib/auth";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { StatsCard } from "@/components/stats-card";
import { EmptyState } from "@/components/empty-state";
import { OccupancyBarList, OccupancyUpsell } from "@/components/reports/occupancy";
import { computeOccupancy, formatMinutes } from "@/lib/occupancy";
import { planHasProducts } from "@/lib/plan-features";
import { lowStockCount } from "@/lib/sales";
import { formatCLP, formatTime } from "@/lib/format";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await auth();
  const db = scopedDb();
  // Gestión: panel completo. Recepción (STAFF): operación del local sin finanzas.
  // Barbero: solo lo suyo. (ownOnly aplica únicamente a BARBER.)
  const { ctx, isManager, ownOnly, barberId } = await viewerScope();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const last30 = subDays(now, 30);

  // Solo el BARBER se limita a su propia agenda; gestión y recepción ven todo.
  const ownScope = ownOnly ? { barberId: barberId ?? "__none__" } : {};

  const [todayAppts, monthAppts, upcoming] = await Promise.all([
    db.appointment.count({
      where: {
        ...ownScope,
        startsAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: [AppointmentStatus.CANCELLED] },
      },
    }),
    db.appointment.count({
      where: {
        ...ownScope,
        startsAt: { gte: monthStart, lte: monthEnd },
        status: AppointmentStatus.COMPLETED,
      },
    }),
    db.appointment.findMany({
      where: {
        ...ownScope,
        startsAt: { gte: now },
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
        },
      },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: {
        client: { select: { firstName: true, lastName: true } },
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
  ]);

  // Métricas financieras / de negocio: solo gestión.
  const [monthRevenue, activeClients, newClients30, barberStats, barberSums, occupyingToday, tenantPlan] =
    isManager
      ? await Promise.all([
          db.appointment.aggregate({
            where: {
              startsAt: { gte: monthStart, lte: monthEnd },
              status: AppointmentStatus.COMPLETED,
            },
            _sum: { totalPrice: true },
          }),
          db.client.count({ where: { totalVisits: { gt: 0 } } }),
          db.client.count({ where: { createdAt: { gte: last30 } } }),
          db.barber.findMany({
            where: { active: true },
            select: {
              id: true,
              user: { select: { name: true } },
              commissionRate: true,
              // Horario y bloqueos de hoy para la ocupación del día.
              schedule: { select: { weekday: true, startMin: true, endMin: true } },
              timeOff: {
                where: { startsAt: { lte: dayEnd }, endsAt: { gte: dayStart } },
                select: { startsAt: true, endsAt: true },
              },
            },
          }),
          // Suma agregada en BD (antes: todas las citas de 30 días a JS para un reduce).
          db.appointment.groupBy({
            by: ["barberId"],
            where: { startsAt: { gte: last30 }, status: AppointmentStatus.COMPLETED },
            _sum: { totalPrice: true },
            _count: true,
          }),
          db.appointment.findMany({
            where: {
              startsAt: { gte: dayStart, lte: dayEnd },
              status: {
                in: [
                  AppointmentStatus.SCHEDULED,
                  AppointmentStatus.CONFIRMED,
                  AppointmentStatus.IN_PROGRESS,
                  AppointmentStatus.COMPLETED,
                ],
              },
            },
            select: { barberId: true, startsAt: true, endsAt: true },
            take: 2000,
          }),
          // Tenant no lleva columna tenantId → prisma directo, no scopedDb.
          prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true } }),
        ])
      : [null, 0, 0, [] as never[], [] as never[], [] as never[], null];

  // Alerta de reposición: productos activos en o bajo su stock mínimo. Solo
  // gestión y solo si el plan incluye productos (FREE ni siquiera consulta).
  const lowStock =
    isManager && tenantPlan && planHasProducts(tenantPlan.plan)
      ? await lowStockCount(ctx.tenantId)
      : 0;

  const occupancyToday = isManager
    ? computeOccupancy({
        barbers: barberStats.map((b) => ({ id: b.id, name: b.user.name })),
        schedules: barberStats.flatMap((b) => b.schedule.map((s) => ({ ...s, barberId: b.id }))),
        timeOff: barberStats.flatMap((b) => b.timeOff.map((t) => ({ ...t, barberId: b.id }))),
        appointments: occupyingToday,
        from: dayStart,
        to: dayEnd,
      })
    : null;
  const advancedReports = tenantPlan?.plan === "PRO" || tenantPlan?.plan === "ENTERPRISE";

  const sumByBarber = new Map(
    (barberSums as { barberId: string; _sum: { totalPrice: number | null }; _count: number }[]).map(
      (s) => [s.barberId, s],
    ),
  );

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Hola, {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de tu barbería al {new Date().toLocaleDateString("es-CL")}.
        </p>
      </div>

      {lowStock > 0 && (
        <Link
          href="/productos"
          className="mb-6 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm transition-colors hover:bg-amber-500/15"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            <strong>{lowStock}</strong> producto{lowStock === 1 ? "" : "s"} con stock bajo — revisa el
            inventario →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Hoy" value={String(todayAppts)} icon={Calendar} />
        <StatsCard
          label="Cortes del mes"
          value={String(monthAppts)}
          icon={TrendingUp}
        />
        {isManager && (
          <>
            <StatsCard
              label="Ingresos del mes"
              value={formatCLP(monthRevenue?._sum.totalPrice ?? 0)}
              icon={DollarSign}
            />
            <StatsCard
              label="Clientes activos"
              value={String(activeClients)}
              trend={{ value: `+${newClients30} este mes`, positive: true }}
              icon={Users}
            />
          </>
        )}
      </div>

      <div className={`mt-8 grid grid-cols-1 gap-6 ${isManager ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
        {/* Próximas citas */}
        <Card>
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-medium">Próximas citas</h2>
            <Link href="/agenda" className="text-xs text-muted-foreground hover:text-foreground">
              Ver agenda →
            </Link>
          </div>
          <div className="p-2">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No hay citas próximas"
                description="Tu agenda está libre. ¡Tiempo de cortar pelo!"
                className="m-3"
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {a.client.firstName} {a.client.lastName ?? ""}
                        </span>
                        {a.status === AppointmentStatus.CONFIRMED && (
                          <Badge variant="success" className="text-xs">
                            Confirmada
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {a.barber.user.name} ·{" "}
                        {a.services.map((s) => s.service.name).join(", ")}
                      </div>
                    </div>
                    <div className="ml-4 text-right text-xs text-muted-foreground">
                      <div>
                        {new Date(a.startsAt).toLocaleDateString("es-CL", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                      <div className="font-medium text-foreground">
                        {formatTime(a.startsAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Ranking barberos + ocupación del día — solo gestión */}
        {isManager && (
        <div className="space-y-6">
        <Card>
          <div className="border-b border-border p-5">
            <h2 className="font-medium">Ranking del mes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Últimos 30 días</p>
          </div>
          <div className="p-2">
            {barberStats.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Sin barberos aún"
                description="Agrega tu equipo en la sección Barberos."
                className="m-3"
              />
            ) : (
              <ul className="divide-y divide-border">
                {barberStats
                  .map((b) => {
                    const agg = sumByBarber.get(b.id);
                    const revenue = agg?._sum.totalPrice ?? 0;
                    return {
                      id: b.id,
                      name: b.user.name,
                      appts: agg?._count ?? 0,
                      revenue,
                      commission: Math.round(revenue * b.commissionRate),
                    };
                  })
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((b, i) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{b.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.appts} cortes · comisión {formatCLP(b.commission)}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-medium tabular-nums">
                        {formatCLP(b.revenue)}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>

        {occupancyToday && occupancyToday.pct !== null && (
          <Card>
            <div className="flex items-baseline justify-between border-b border-border p-5">
              <div>
                <h2 className="font-medium">Ocupación de hoy</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatMinutes(occupancyToday.bookedMin)} reservadas de{" "}
                  {formatMinutes(occupancyToday.capacityMin)} disponibles
                </p>
              </div>
              <span className="text-2xl font-medium tabular-nums tracking-tight">
                {Math.round(occupancyToday.pct * 100)}%
              </span>
            </div>
            <div className="p-5">
              {advancedReports ? (
                <OccupancyBarList rows={occupancyToday.byBarber} />
              ) : (
                <OccupancyUpsell />
              )}
            </div>
          </Card>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
