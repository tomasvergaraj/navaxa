import { eachDayOfInterval, getDay } from "date-fns";
import { WEEKDAY_LABELS } from "./agenda";

/**
 * Ocupación = minutos reservados / minutos de capacidad real.
 * Capacidad = horario del barbero (BarberSchedule) menos sus bloqueos
 * (BarberTimeOff) dentro del rango. Los datos entran ya consultados (la página
 * hace las queries con scopedDb); acá solo se calcula, sin tocar la BD.
 */

export interface OccupancyBarber {
  id: string;
  name: string;
}

export interface OccupancySchedule {
  barberId: string;
  weekday: number; // 0=domingo … 6=sábado
  startMin: number;
  endMin: number;
}

export interface OccupancyTimeOff {
  barberId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface OccupancyAppointment {
  barberId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface BarberOccupancy {
  id: string;
  name: string;
  capacityMin: number;
  bookedMin: number;
  /** 0–1, tope en 1 (citas fuera de horario pueden exceder la capacidad). */
  pct: number;
}

export interface HeatmapCell {
  hour: number;
  capacityMin: number;
  bookedMin: number;
  /** 0–1, o null si no hay capacidad en esa celda (local cerrado). */
  pct: number | null;
}

export interface HeatmapDay {
  weekday: number;
  label: string;
  cells: HeatmapCell[];
}

export interface OccupancyResult {
  capacityMin: number;
  bookedMin: number;
  /** 0–1, o null si no hay capacidad en el rango (sin horarios definidos). */
  pct: number | null;
  byBarber: BarberOccupancy[];
  /** Perfil día de semana × hora, agregado sobre todo el rango. */
  heatmap: { hours: number[]; days: HeatmapDay[] } | null;
}

type Interval = [number, number]; // minutos desde 00:00, [start, end)

/** Resta `offs` de `windows` (intervalos en minutos del día, semiabiertos). */
function subtractIntervals(windows: Interval[], offs: Interval[]): Interval[] {
  let result = windows;
  for (const [os, oe] of offs) {
    if (oe <= os) continue;
    const next: Interval[] = [];
    for (const [ws, we] of result) {
      if (oe <= ws || os >= we) {
        next.push([ws, we]);
        continue;
      }
      if (os > ws) next.push([ws, os]);
      if (oe < we) next.push([oe, we]);
    }
    result = next;
  }
  return result;
}

/** Minutos del intervalo que caen dentro del día `d` (para bloqueos multi-día). */
function clampToDay(d: Date, startsAt: Date, endsAt: Date): Interval | null {
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayEnd = new Date(+dayStart + 86_400_000);
  const s = Math.max(+startsAt, +dayStart);
  const e = Math.min(+endsAt, +dayEnd);
  if (e <= s) return null;
  return [Math.round((s - +dayStart) / 60_000), Math.round((e - +dayStart) / 60_000)];
}

/** Reparte un intervalo [start,end) en buckets de hora del acumulador. */
function addToHourBuckets(acc: Map<number, number>, [start, end]: Interval) {
  for (let h = Math.floor(start / 60); h * 60 < end; h++) {
    const overlap = Math.min(end, (h + 1) * 60) - Math.max(start, h * 60);
    if (overlap > 0) acc.set(h, (acc.get(h) ?? 0) + overlap);
  }
}

export function computeOccupancy(input: {
  barbers: OccupancyBarber[];
  schedules: OccupancySchedule[];
  timeOff: OccupancyTimeOff[];
  appointments: OccupancyAppointment[];
  from: Date;
  to: Date;
}): OccupancyResult {
  const { barbers, schedules, timeOff, appointments, from, to } = input;

  const windowsByBarberWeekday = new Map<string, Interval[]>();
  for (const s of schedules) {
    const key = `${s.barberId}:${s.weekday}`;
    const list = windowsByBarberWeekday.get(key) ?? [];
    list.push([s.startMin, s.endMin]);
    windowsByBarberWeekday.set(key, list);
  }

  const offsByBarber = new Map<string, OccupancyTimeOff[]>();
  for (const t of timeOff) {
    const list = offsByBarber.get(t.barberId) ?? [];
    list.push(t);
    offsByBarber.set(t.barberId, list);
  }

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const bookedByBarberDay = new Map<string, Interval[]>();
  for (const a of appointments) {
    const day = new Date(a.startsAt.getFullYear(), a.startsAt.getMonth(), a.startsAt.getDate());
    const iv = clampToDay(day, a.startsAt, a.endsAt);
    if (!iv) continue;
    const key = `${a.barberId}:${ymd(day)}`;
    const list = bookedByBarberDay.get(key) ?? [];
    list.push(iv);
    bookedByBarberDay.set(key, list);
  }

  const days = eachDayOfInterval({ start: from, end: to });
  const capByBarber = new Map<string, number>();
  const bookedByBarber = new Map<string, number>();
  // Heatmap: capacidad y reservado por (weekday, hora), acumulado sobre el rango.
  const capByCell = new Map<string, number>();
  const bookedByCell = new Map<string, number>();

  for (const b of barbers) {
    capByBarber.set(b.id, 0);
    bookedByBarber.set(b.id, 0);
  }

  for (const d of days) {
    const wd = getDay(d);
    for (const b of barbers) {
      const windows = windowsByBarberWeekday.get(`${b.id}:${wd}`);
      if (windows?.length) {
        const offs = (offsByBarber.get(b.id) ?? [])
          .map((t) => clampToDay(d, t.startsAt, t.endsAt))
          .filter((iv): iv is Interval => iv !== null);
        const effective = subtractIntervals(windows, offs);

        const capHours = new Map<number, number>();
        for (const iv of effective) addToHourBuckets(capHours, iv);
        let dayCap = 0;
        for (const [h, min] of capHours) {
          dayCap += min;
          capByCell.set(`${wd}:${h}`, (capByCell.get(`${wd}:${h}`) ?? 0) + min);
        }
        capByBarber.set(b.id, (capByBarber.get(b.id) ?? 0) + dayCap);
      }

      const booked = bookedByBarberDay.get(`${b.id}:${ymd(d)}`);
      if (booked?.length) {
        const bookedHours = new Map<number, number>();
        for (const iv of booked) addToHourBuckets(bookedHours, iv);
        let dayBooked = 0;
        for (const [h, min] of bookedHours) {
          dayBooked += min;
          bookedByCell.set(`${wd}:${h}`, (bookedByCell.get(`${wd}:${h}`) ?? 0) + min);
        }
        bookedByBarber.set(b.id, (bookedByBarber.get(b.id) ?? 0) + dayBooked);
      }
    }
  }

  const byBarber: BarberOccupancy[] = barbers
    .map((b) => {
      const capacityMin = capByBarber.get(b.id) ?? 0;
      const bookedMin = bookedByBarber.get(b.id) ?? 0;
      return {
        id: b.id,
        name: b.name,
        capacityMin,
        bookedMin,
        pct: capacityMin > 0 ? Math.min(1, bookedMin / capacityMin) : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  const capacityMin = byBarber.reduce((s, b) => s + b.capacityMin, 0);
  const bookedMin = byBarber.reduce((s, b) => s + b.bookedMin, 0);

  // Rango horario del heatmap: de la primera a la última hora con capacidad.
  let heatmap: OccupancyResult["heatmap"] = null;
  if (capByCell.size > 0) {
    let minHour = 24;
    let maxHour = 0;
    for (const key of capByCell.keys()) {
      const h = Number(key.split(":")[1]);
      if (h < minHour) minHour = h;
      if (h > maxHour) maxHour = h;
    }
    const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
    // Lunes primero (semana laboral); domingo al final.
    const weekdays = [1, 2, 3, 4, 5, 6, 0];
    heatmap = {
      hours,
      days: weekdays.map((wd) => ({
        weekday: wd,
        label: WEEKDAY_LABELS[wd]!,
        cells: hours.map((hour) => {
          const cap = capByCell.get(`${wd}:${hour}`) ?? 0;
          const booked = bookedByCell.get(`${wd}:${hour}`) ?? 0;
          return {
            hour,
            capacityMin: cap,
            bookedMin: booked,
            pct: cap > 0 ? Math.min(1, booked / cap) : null,
          };
        }),
      })),
    };
  }

  return {
    capacityMin,
    bookedMin,
    pct: capacityMin > 0 ? Math.min(1, bookedMin / capacityMin) : null,
    byBarber,
    heatmap,
  };
}

/** "42 h" / "90 min" para mostrar capacidad/reserva en tooltips. */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
