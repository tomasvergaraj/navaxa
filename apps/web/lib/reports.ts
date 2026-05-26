import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
} from "date-fns";
import { es } from "date-fns/locale";

export type Bucket = "day" | "week" | "month";

export interface Period {
  from: Date;
  to: Date;
  bucket: Bucket;
  rangeKey: string; // "7d" | "30d" | "90d" | "month" | "prev_month" | "custom"
}

function pickBucket(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** Lee el período desde los searchParams: ?range=… o ?from=YYYY-MM-DD&to=YYYY-MM-DD. */
export function parsePeriod(sp: { range?: string; from?: string; to?: string }): Period {
  const now = new Date();

  if (sp.from && sp.to) {
    const from = startOfDay(new Date(sp.from));
    const to = endOfDay(new Date(sp.to));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      return { from, to, bucket: pickBucket(from, to), rangeKey: "custom" };
    }
  }

  switch (sp.range) {
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), bucket: "day", rangeKey: "7d" };
    case "90d": {
      const from = startOfDay(subDays(now, 89));
      return { from, to: endOfDay(now), bucket: pickBucket(from, now), rangeKey: "90d" };
    }
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now), bucket: "day", rangeKey: "month" };
    case "prev_month": {
      const s = startOfMonth(subMonths(now, 1));
      return { from: s, to: endOfMonth(s), bucket: "day", rangeKey: "prev_month" };
    }
    case "30d":
    default: {
      const from = startOfDay(subDays(now, 29));
      return { from, to: endOfDay(now), bucket: "day", rangeKey: "30d" };
    }
  }
}

function bucketKey(d: Date, bucket: Bucket): string {
  if (bucket === "day") return format(d, "yyyy-MM-dd");
  if (bucket === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(d, "yyyy-MM");
}

function bucketLabel(d: Date, bucket: Bucket): string {
  if (bucket === "day") return format(d, "d MMM", { locale: es });
  if (bucket === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "d MMM", { locale: es });
  return format(d, "MMM yy", { locale: es });
}

export interface ChartPoint {
  label: string;
  value: number;
}

/** Agrupa ingresos por bucket (día/semana/mes) cubriendo todo el rango (con ceros). */
export function bucketRevenue(
  rows: { startsAt: Date; totalPrice: number }[],
  p: Period,
): ChartPoint[] {
  const starts =
    p.bucket === "day"
      ? eachDayOfInterval({ start: p.from, end: p.to })
      : p.bucket === "week"
        ? eachWeekOfInterval({ start: p.from, end: p.to }, { weekStartsOn: 1 })
        : eachMonthOfInterval({ start: p.from, end: p.to });

  const index = new Map<string, number>();
  const points: ChartPoint[] = starts.map((s, i) => {
    index.set(bucketKey(s, p.bucket), i);
    return { label: bucketLabel(s, p.bucket), value: 0 };
  });

  for (const r of rows) {
    const i = index.get(bucketKey(r.startsAt, p.bucket));
    if (i !== undefined) points[i]!.value += r.totalPrice;
  }
  return points;
}

/** "26 may – 25 jun 2026" para mostrar el rango activo. */
export function formatPeriodRange(p: Period): string {
  const sameYear = p.from.getFullYear() === p.to.getFullYear();
  const from = format(p.from, sameYear ? "d MMM" : "d MMM yyyy", { locale: es });
  const to = format(p.to, "d MMM yyyy", { locale: es });
  return `${from} – ${to}`;
}
