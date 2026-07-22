import Link from "next/link";
import { Button } from "@navaxa/ui";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from "lucide-react";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { AgendaGrid } from "@/components/agenda/agenda-grid";
import { PageHeader } from "@/components/page-header";
import { AgendaWeek } from "@/components/agenda/agenda-week";
import { UnmarkedBanner, type UnmarkedItem } from "@/components/agenda/unmarked-banner";
import { scopedDb } from "@/lib/tenant";
import { viewerScope } from "@/lib/page-guards";
import { prisma, AppointmentStatus } from "@navaxa/db";
import {
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  getDay,
} from "date-fns";
import { formatDateShort } from "@/lib/format";
import { buildDayGrid, buildWeekCapacity, type RawBarber } from "@/lib/agenda";
import { computeAppointmentBalance } from "@/lib/appointment-balance";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { date?: string; view?: string };
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const view = searchParams.view === "week" ? "week" : "day";
  const date = searchParams.date ? new Date(`${searchParams.date}T12:00:00`) : new Date();
  const todayYmd = ymd(new Date());

  const db = scopedDb();
  // Solo el BARBER ve únicamente su columna. Gestión y recepción (STAFF) ven
  // la agenda completa del local.
  const { ownOnly, barberId } = await viewerScope();
  const barbersRaw = await db.barber.findMany({
    where: {
      active: true,
      ...(ownOnly ? { id: barberId ?? "__none__" } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const barbers: RawBarber[] = barbersRaw.map((b) => ({ id: b.id, name: b.user.name }));
  const barberIds = barbers.map((b) => b.id);

  // Citas pasadas (antes de hoy) que nadie marcó: siguen en Agendada/Confirmada/
  // En curso. Se ofrecen para completar/no-vino a mano — no se auto-completan
  // porque COMPLETED dispara comisiones + invitación de reseña.
  const unmarkedRaw = await db.appointment.findMany({
    where: {
      startsAt: { lt: startOfDay(new Date()) },
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
      },
      ...(ownOnly ? { barberId: barberId ?? "__none__" } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 50,
    select: {
      id: true,
      startsAt: true,
      totalPrice: true,
      client: { select: { firstName: true, lastName: true } },
      barber: { select: { user: { select: { name: true } } } },
      payment: { select: { amount: true, status: true } },
      sales: { where: { cancelledAt: null }, select: { total: true } },
    },
  });
  const unmarked: UnmarkedItem[] = unmarkedRaw.map((a) => ({
    id: a.id,
    when: `${a.startsAt.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}, ${a.startsAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`,
    clientName: `${a.client.firstName} ${a.client.lastName ?? ""}`.trim(),
    barberName: a.barber.user.name,
    balance: computeAppointmentBalance({
      totalPrice: a.totalPrice,
      payment: a.payment,
      sales: a.sales,
    }).balance,
  }));

  // Navegación (preserva la vista actual)
  const step = view === "week" ? 7 : 1;
  const prev = `/agenda?view=${view}&date=${ymd(subDays(date, step))}`;
  const next = `/agenda?view=${view}&date=${ymd(addDays(date, step))}`;
  const todayHref = `/agenda?view=${view}`;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 md:px-6">
      <PageHeader
        className="mb-4 shrink-0"
        title="Agenda"
        subtitle={
          <span className="capitalize">
            {view === "week" ? (
              <>Semana del {formatDateShort(startOfWeek(date, { weekStartsOn: 1 }))} al {formatDateShort(endOfWeek(date, { weekStartsOn: 1 }))}</>
            ) : (
              date.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            )}
          </span>
        }
        action={<NewAppointmentDialog label="Nueva cita" />}
      />

      <UnmarkedBanner items={unmarked} />

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={prev} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={todayHref}>Hoy</Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={next} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>

        {/* Selector Día / Semana */}
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border">
          <Button variant={view === "day" ? "default" : "ghost"} size="sm" className="rounded-none" asChild>
            <Link href={`/agenda?view=day&date=${ymd(date)}`} aria-current={view === "day" ? "page" : undefined}>
              <LayoutGrid className="h-4 w-4" /> Día
            </Link>
          </Button>
          <Button variant={view === "week" ? "default" : "ghost"} size="sm" className="rounded-none" asChild>
            <Link href={`/agenda?view=week&date=${ymd(date)}`} aria-current={view === "week" ? "page" : undefined}>
              <CalendarDays className="h-4 w-4" /> Semana
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {barbers.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Agrega barberos para empezar a usar la agenda.
            </p>
          </div>
        ) : view === "week" ? (
          <div className="min-h-0 flex-1 overflow-auto">{await renderWeek(db, barbers, barberIds, date)}</div>
        ) : (
          await renderDay(db, barbers, barberIds, date, todayYmd)
        )}
      </div>
    </div>
  );
}

async function renderDay(
  db: ReturnType<typeof scopedDb>,
  barbers: RawBarber[],
  barberIds: string[],
  date: Date,
  todayYmd: string,
) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const weekday = getDay(date);

  const [appointments, schedules] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { gte: dayStart, lte: dayEnd }, status: { notIn: [AppointmentStatus.CANCELLED] } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        barberId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        totalPrice: true,
        notes: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        services: { select: { service: { select: { name: true, color: true } } } },
        // Saldo pendiente: abono online + cobros ya registrados contra la cita.
        payment: { select: { amount: true, status: true } },
        sales: { where: { cancelledAt: null }, select: { total: true } },
      },
    }),
    prisma.barberSchedule.findMany({
      where: { barberId: { in: barberIds }, weekday },
      select: { barberId: true, weekday: true, startMin: true, endMin: true },
    }),
  ]);

  const grid = buildDayGrid(barbers, schedules, appointments, date);

  return (
    <AgendaGrid
      dateStr={ymd(date)}
      dayStartMs={dayStart.getTime()}
      isToday={ymd(date) === todayYmd}
      startMin={grid.startMin}
      endMin={grid.endMin}
      columns={grid.columns}
    />
  );
}

async function renderWeek(
  db: ReturnType<typeof scopedDb>,
  barbers: RawBarber[],
  barberIds: string[],
  date: Date,
) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

  const [appointments, schedules] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { gte: weekStart, lte: weekEnd }, status: { notIn: [AppointmentStatus.CANCELLED] } },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
    prisma.barberSchedule.findMany({
      where: { barberId: { in: barberIds } },
      select: { barberId: true, weekday: true, startMin: true, endMin: true },
    }),
  ]);

  const capacity = buildWeekCapacity(barbers, schedules, appointments, weekStart);

  return <AgendaWeek capacity={capacity} />;
}
