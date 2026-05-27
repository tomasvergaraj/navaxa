import Link from "next/link";
import { Button } from "@navaxa/ui";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from "lucide-react";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { AgendaGrid } from "@/components/agenda/agenda-grid";
import { AgendaWeek } from "@/components/agenda/agenda-week";
import { scopedDb } from "@/lib/tenant";
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
  const barbersRaw = await db.barber.findMany({
    where: { active: true },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const barbers: RawBarber[] = barbersRaw.map((b) => ({ id: b.id, name: b.user.name }));
  const barberIds = barbers.map((b) => b.id);

  // Navegación (preserva la vista actual)
  const step = view === "week" ? 7 : 1;
  const prev = `/agenda?view=${view}&date=${ymd(subDays(date, step))}`;
  const next = `/agenda?view=${view}&date=${ymd(addDays(date, step))}`;
  const todayHref = `/agenda?view=${view}`;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 md:px-6">
      <header className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {view === "week" ? (
              <>Semana del {formatDateShort(startOfWeek(date, { weekStartsOn: 1 }))} al {formatDateShort(endOfWeek(date, { weekStartsOn: 1 }))}</>
            ) : (
              date.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            )}
          </p>
        </div>
        <NewAppointmentDialog label="Nueva cita" />
      </header>

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
            <Link href={`/agenda?view=day&date=${ymd(date)}`}>
              <LayoutGrid className="h-4 w-4" /> Día
            </Link>
          </Button>
          <Button variant={view === "week" ? "default" : "ghost"} size="sm" className="rounded-none" asChild>
            <Link href={`/agenda?view=week&date=${ymd(date)}`}>
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
        client: { select: { firstName: true, lastName: true } },
        services: { select: { service: { select: { name: true, color: true } } } },
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
