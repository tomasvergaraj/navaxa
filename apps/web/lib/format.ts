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

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
