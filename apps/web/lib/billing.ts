import { Plan } from "@navaxa/db";
import { PLANS } from "@navaxa/config";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Planes que se pueden contratar (FREE no se cobra). */
export const PAID_PLANS = ["STARTER", "PRO", "ENTERPRISE"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

export function planPriceClp(plan: Plan): number {
  return PLANS[plan].priceClp;
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
// Codifica tenantId + plan; solo el dueño autenticado puede generarlo.
export function signBillingToken(tenantId: string, plan: PaidPlan): string {
  return signToken("bill", `${tenantId}:${plan}`, TOKEN_TTL.bill);
}

export function verifyBillingToken(token: string): { tenantId: string; plan: PaidPlan } | null {
  const payload = verifyToken("bill", token);
  if (payload === null) return null;
  const idx = payload.lastIndexOf(":");
  if (idx < 0) return null;
  const tenantId = payload.slice(0, idx);
  const plan = payload.slice(idx + 1);
  if (!tenantId || !isPaidPlan(plan)) return null;
  return { tenantId, plan };
}

export function buildBillingCheckoutUrl(token: string): string {
  return `${APP_URL}/facturar/${token}`;
}
