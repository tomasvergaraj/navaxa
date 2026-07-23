import { Plan, BillingInterval } from "@navaxa/db";
import { PLANS, ANNUAL_MONTHS_CHARGED } from "@navaxa/config";

/**
 * Aritmética de planes y períodos, sin dependencias. Vive aparte de
 * lib/billing.ts a propósito: el job de renovación la alcanza desde
 * instrumentation.ts, que webpack bundlea también para Edge, y lib/billing.ts
 * arrastra `node:crypto` (firma de tokens) que ahí no resuelve. Mismo motivo
 * que lib/payment-release.ts.
 *
 * lib/billing.ts re-exporta todo esto, así que los call sites no cambian.
 */

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
