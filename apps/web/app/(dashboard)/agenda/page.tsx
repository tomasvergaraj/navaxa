import Link from "next/link";
import { Card, Badge, Button } from "@navaxa/ui";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { scopedDb } from "@/lib/tenant";
import { AppointmentStatus } from "@navaxa/db";
import { startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { formatTime } from "@/lib/format";
import { APPOINTMENT_STATUS_LABELS } from "@navaxa/config";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { date?: string };
}

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "default" | "success" | "warning" | "destructive" | "outline"
> = {
  PENDING_PAYMENT: "warning",
  SCHEDULED: "outline",
  CONFIRMED: "success",
  IN_PROGRESS: "default",
  COMPLETED: "default",
  NO_SHOW: "destructive",
  CANCELLED: "destructive",
};

export default async function AgendaPage({ searchParams }: PageProps) {
  const date = searchParams.date ? new Date(searchParams.date) : new Date();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const db = scopedDb();

  const [barbers, appointments] = await Promise.all([
    db.barber.findMany({
      where: { active: true },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.appointment.findMany({
      where: {
        startsAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: [AppointmentStatus.CANCELLED] },
      },
      orderBy: { startsAt: "asc" },
      include: {
        client: { select: { firstName: true, lastName: true } },
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: { select: { name: true, color: true } } } },
      },
    }),
  ]);

  // Agrupar por barbero
  const byBarber = new Map<string, typeof appointments>();
  for (const b of barbers) byBarber.set(b.id, []);
  for (const a of appointments) {
    byBarber.get(a.barberId)?.push(a);
  }

  const dateStr = date.toISOString().slice(0, 10);
  const prev = subDays(date, 1).toISOString().slice(0, 10);
  const next = addDays(date, 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = dateStr === today;

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {date.toLocaleDateString("es-CL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <NewAppointmentDialog label="Nueva cita" />
      </header>

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/agenda?date=${prev}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant={isToday ? "default" : "outline"} size="sm" asChild>
          <Link href="/agenda">Hoy</Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={`/agenda?date=${next}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {appointments.length} cita{appointments.length === 1 ? "" : "s"}
        </span>
      </div>

      {barbers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Agrega barberos para empezar a usar la agenda.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b) => {
            const list = byBarber.get(b.id) ?? [];
            return (
              <Card key={b.id} className="overflow-hidden">
                <div className="border-b border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-medium">{b.user.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {b.specialties.slice(0, 3).join(" · ") || "Barbero"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {list.length} cita{list.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
                {list.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Sin citas hoy
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {list.map((a) => (
                      <li key={a.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium tabular-nums">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatTime(a.startsAt)} – {formatTime(a.endsAt)}
                            </div>
                            <div className="mt-1 text-sm">
                              {a.client.firstName} {a.client.lastName ?? ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.services.map((s) => s.service.name).join(", ")}
                            </div>
                          </div>
                          <Badge
                            variant={STATUS_VARIANT[a.status]}
                            className="shrink-0 text-[10px]"
                          >
                            {APPOINTMENT_STATUS_LABELS[a.status]}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
