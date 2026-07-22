/**
 * Formateadores localizados para Chile (es-CL).
 */

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat("es-CL");

const DATE_FULL = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "long",
});

const DATE_SHORT = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
});

const TIME = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATETIME = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Con año: para rastros que duran años (auditoría) o fechas lejanas, donde
// "31-may, 20:00" a secas se lee como si fuera de este año.
const DATETIME_YEAR = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const formatCLP = (pesos: number | bigint) => CLP.format(Number(pesos));
export const formatNumber = (n: number) => NUMBER.format(n);
export const formatDate = (d: Date | string) =>
  DATE_FULL.format(typeof d === "string" ? new Date(d) : d);
export const formatDateShort = (d: Date | string) =>
  DATE_SHORT.format(typeof d === "string" ? new Date(d) : d);
export const formatTime = (d: Date | string) =>
  TIME.format(typeof d === "string" ? new Date(d) : d);
export const formatDateTime = (d: Date | string) =>
  DATETIME.format(typeof d === "string" ? new Date(d) : d);
export const formatDateTimeYear = (d: Date | string) =>
  DATETIME_YEAR.format(typeof d === "string" ? new Date(d) : d);

export function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays < 1) return "hoy";
  if (diffDays < 2) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
  return `hace ${Math.floor(diffDays / 365)} años`;
}

/**
 * "Hoy" como YYYY-MM-DD en la timezone del LOCAL, no la del dispositivo: un
 * cliente en otra zona veía el número de día corrido.
 */
export function todayYmd(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

/** Los próximos `count` días (incluye hoy) como YYYY-MM-DD en `timezone`. */
export function nextDaysYmd(timezone: string, count = 14): string[] {
  const [y, m, d] = todayYmd(timezone).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // Mediodía UTC: evita que el ±1 día del offset cruce la fecha al serializar.
    out.push(new Date(Date.UTC(y, m - 1, d + i, 12)).toISOString().slice(0, 10));
  }
  return out;
}

const WEEKDAY_SHORT_UTC = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  weekday: "short",
});

/**
 * Día abreviado de un YYYY-MM-DD. El ymd ya viene calculado en la TZ del local,
 * así que se interpreta a mediodía UTC y se formatea en UTC: reinterpretarlo en
 * otra zona corría el día. Módulo-level a propósito: los chips lo llamaban 14
 * veces por render y cada llamada construía un Intl.DateTimeFormat nuevo.
 */
export const weekdayShortFromYmd = (ymd: string) =>
  WEEKDAY_SHORT_UTC.format(new Date(`${ymd}T12:00:00.000Z`));

/**
 * Formateadores es-CL atados a la timezone del local. Construir un
 * Intl.DateTimeFormat es caro: memoiza el resultado por timezone en el caller.
 */
export function tzFormatters(timezone: string) {
  return {
    time: new Intl.DateTimeFormat("es-CL", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    dayLong: new Intl.DateTimeFormat("es-CL", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    weekdayShort: new Intl.DateTimeFormat("es-CL", { timeZone: timezone, weekday: "short" }),
  };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
