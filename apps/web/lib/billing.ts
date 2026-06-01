import { Plan, BillingInterval } from "@navaxa/db";
import { PLANS, ANNUAL_MONTHS_CHARGED } from "@navaxa/config";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Planes que se pueden contratar (FREE no se cobra). */
export const PAID_PLANS = ["STARTER", "PRO", "ENTERPRISE"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

export function isBillingInterval(v: string): v is BillingInterval {
  return v === "MONTHLY" || v === "ANNUAL";
}

/** Precio a cobrar según intervalo: anual = mensual × ANNUAL_MONTHS_CHARGED (2 meses gratis). */
export function planPriceClp(plan: Plan, interval: BillingInterval = "MONTHLY"): number {
  const monthly = PLANS[plan].priceClp;
  return interval === "ANNUAL" ? monthly * ANNUAL_MONTHS_CHARGED : monthly;
}

/** Meses que dura el período pagado según intervalo. */
export function periodMonths(interval: BillingInterval): number {
  return interval === "ANNUAL" ? 12 : 1;
}

export function planName(plan: Plan): string {
  return PLANS[plan].name;
}

/** Suma meses a una fecha conservando el día (corrige fin de mes). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // si el mes destino es más corto
  return d;
}

// ---- Token de checkout de plan (stateless, HMAC) ----
// Codifica tenantId + plan + intervalo; solo el dueño autenticado puede generarlo.
export function signBillingToken(
  tenantId: string,
  plan: PaidPlan,
  interval: BillingInterval = "MONTHLY",
): string {
  return signToken("bill", `${tenantId}:${plan}:${interval}`, TOKEN_TTL.bill);
}

export function verifyBillingToken(
  token: string,
): { tenantId: string; plan: PaidPlan; interval: BillingInterval } | null {
  const payload = verifyToken("bill", token);
  if (payload === null) return null;
  // tenantId (cuid, sin ":") : plan : interval. Tokens viejos sin interval → MONTHLY.
  const parts = payload.split(":");
  if (parts.length < 2) return null;
  const [tenantId, plan, intervalStr] = parts;
  if (!tenantId || !isPaidPlan(plan)) return null;
  const interval: BillingInterval =
    intervalStr && isBillingInterval(intervalStr) ? intervalStr : "MONTHLY";
  return { tenantId, plan, interval };
}

export function buildBillingCheckoutUrl(token: string): string {
  return `${APP_URL}/facturar/${token}`;
}
