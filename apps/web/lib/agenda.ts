import { startOfDay, getDay, addDays } from "date-fns";
import { AppointmentStatus } from "@navaxa/db";
import { computeAppointmentBalance } from "./appointment-balance";

/**
 * Transforms puros para la agenda. Calculan los offsets en MINUTOS desde la
 * medianoche local en el servidor, de modo que la grilla cliente solo posiciona
 * por número (sin riesgo de desfase de zona horaria entre server y browser).
 */

const DEFAULT_START_MIN = 9 * 60; // 09:00 si no hay horarios
const DEFAULT_END_MIN = 20 * 60; // 20:00

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

const RESCHEDULABLE = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]);

export interface ScheduleWindow {
  startMin: number;
  endMin: number;
}

export interface RawSchedule {
  barberId: string;
  weekday: number;
  startMin: number;
  endMin: number;
}

export interface RawBarber {
  id: string;
  name: string;
}

export interface RawAppointment {
  id: string;
  barberId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  totalPrice: number;
  notes: string | null;
  client: { id: string; firstName: string; lastName: string | null };
  services: { service: { name: string; color: string | null } }[];
  /** Abono online, si lo hubo. Alimenta el saldo pendiente. */
  payment?: { amount: number; status: string } | null;
  /** Cobros ya registrados contra la cita (el llamador filtra las anuladas). */
  sales?: { total: number }[] | null;
}

export interface GridBlock {
  id: string;
  clientId: string;
  barberId: string;
  barberName: string;
  startMin: number;
  endMin: number;
  startsAtIso: string;
  endsAtIso: string;
  status: AppointmentStatus;
  clientName: string;
  serviceNames: string[];
  color: string | null;
  totalPrice: number;
  /** Abono pagado + cobros registrados. Ver `lib/appointment-balance.ts`. */
  paidAmount: number;
  /** Lo que falta por cobrar en el local. 0 si está saldada. */
  balance: number;
  notes: string | null;
  /** Solo SCHEDULED/CONFIRMED se pueden arrastrar (coincide con el backend). */
  draggable: boolean;
}

export interface GridColumn {
  barberId: string;
  barberName: string;
  windows: ScheduleWindow[];
  blocks: GridBlock[];
}

export interface DayGrid {
  startMin: number;
  endMin: number;
  columns: GridColumn[];
}

function minutesSinceMidnight(d: Date, dayStart: Date): number {
  return Math.round((+d - +dayStart) / 60000);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Arma la grilla diaria por barbero (columnas), con ventanas de trabajo y bloques. */
export function buildDayGrid(
  barbers: RawBarber[],
  schedules: RawSchedule[],
  appointments: RawAppointment[],
  date: Date,
): DayGrid {
  const dayStart = startOfDay(date);
  const weekday = getDay(date);

  const winByBarber = new Map<string, ScheduleWindow[]>();
  const blocksByBarber = new Map<string, GridBlock[]>();
  for (const b of barbers) {
    winByBarber.set(b.id, []);
    blocksByBarber.set(b.id, []);
  }

  for (const s of schedules) {
    if (s.weekday !== weekday) continue;
    winByBarber.get(s.barberId)?.push({ startMin: s.startMin, endMin: s.endMin });
  }
  for (const wins of winByBarber.values()) wins.sort((a, b) => a.startMin - b.startMin);

  const barberNameById = new Map(barbers.map((b) => [b.id, b.name]));
  for (const a of appointments) {
    const { paid, balance } = computeAppointmentBalance({
      totalPrice: a.totalPrice,
      payment: a.payment,
      sales: a.sales,
    });
    blocksByBarber.get(a.barberId)?.push({
      id: a.id,
      clientId: a.client.id,
      barberId: a.barberId,
      barberName: barberNameById.get(a.barberId) ?? "",
      startMin: minutesSinceMidnight(a.startsAt, dayStart),
      endMin: minutesSinceMidnight(a.endsAt, dayStart),
      startsAtIso: a.startsAt.toISOString(),
      endsAtIso: a.endsAt.toISOString(),
      status: a.status,
      clientName: `${a.client.firstName} ${a.client.lastName ?? ""}`.trim(),
      serviceNames: a.services.map((s) => s.service.name),
      color: a.services[0]?.service.color ?? null,
      totalPrice: a.totalPrice,
      paidAmount: paid,
      balance,
      notes: a.notes,
      draggable: RESCHEDULABLE.has(a.status),
    });
  }

  // Límites de la grilla: unión de ventanas de horario y de las citas del día.
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const wins of winByBarber.values())
    for (const w of wins) {
      minStart = Math.min(minStart, w.startMin);
      maxEnd = Math.max(maxEnd, w.endMin);
    }
  for (const blocks of blocksByBarber.values())
    for (const b of blocks) {
      minStart = Math.min(minStart, b.startMin);
      maxEnd = Math.max(maxEnd, b.endMin);
    }
  if (!Number.isFinite(minStart)) {
    minStart = DEFAULT_START_MIN;
    maxEnd = DEFAULT_END_MIN;
  }

  const startMin = Math.max(0, Math.floor(minStart / 60) * 60);
  const endMin = Math.min(24 * 60, Math.ceil(maxEnd / 60) * 60);

  const columns: GridColumn[] = barbers.map((b) => ({
    barberId: b.id,
    barberName: b.name,
    windows: winByBarber.get(b.id) ?? [],
    blocks: blocksByBarber.get(b.id) ?? [],
  }));

  return { startMin, endMin: Math.max(endMin, startMin + 60), columns };
}

export interface WeekDayCell {
  date: string;
  weekday: number;
  availableMin: number;
  bookedMin: number;
  pct: number;
  count: number;
}

export interface WeekRow {
  barberId: string;
  barberName: string;
  cells: WeekDayCell[];
  totalBookedMin: number;
  totalAvailableMin: number;
}

export interface WeekCapacity {
  days: { date: string; weekday: number; label: string }[];
  rows: WeekRow[];
}

/** Capacidad semanal: % de ocupación (minutos reservados / disponibles) por barbero y día. */
export function buildWeekCapacity(
  barbers: RawBarber[],
  schedules: RawSchedule[],
  appointments: { barberId: string; startsAt: Date; endsAt: Date }[],
  weekStart: Date,
): WeekCapacity {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const wd = getDay(d);
    return { date: ymd(d), weekday: wd, label: WEEKDAY_LABELS[wd] };
  });

  const availByBarberWeekday = new Map<string, Map<number, number>>();
  const bookedByBarberDate = new Map<string, Map<string, { min: number; count: number }>>();
  for (const b of barbers) {
    availByBarberWeekday.set(b.id, new Map());
    bookedByBarberDate.set(b.id, new Map());
  }

  for (const s of schedules) {
    const m = availByBarberWeekday.get(s.barberId);
    if (m) m.set(s.weekday, (m.get(s.weekday) ?? 0) + (s.endMin - s.startMin));
  }

  for (const a of appointments) {
    const m = bookedByBarberDate.get(a.barberId);
    if (!m) continue;
    const key = ymd(a.startsAt);
    const dur = Math.round((+a.endsAt - +a.startsAt) / 60000);
    const cur = m.get(key) ?? { min: 0, count: 0 };
    cur.min += dur;
    cur.count += 1;
    m.set(key, cur);
  }

  const rows: WeekRow[] = barbers.map((b) => {
    let totalBookedMin = 0;
    let totalAvailableMin = 0;
    const cells: WeekDayCell[] = days.map((d) => {
      const availableMin = availByBarberWeekday.get(b.id)?.get(d.weekday) ?? 0;
      const booked = bookedByBarberDate.get(b.id)?.get(d.date) ?? { min: 0, count: 0 };
      totalBookedMin += booked.min;
      totalAvailableMin += availableMin;
      return {
        date: d.date,
        weekday: d.weekday,
        availableMin,
        bookedMin: booked.min,
        pct: availableMin > 0 ? Math.min(1, booked.min / availableMin) : 0,
        count: booked.count,
      };
    });
    return { barberId: b.id, barberName: b.name, cells, totalBookedMin, totalAvailableMin };
  });

  return { days, rows };
}
