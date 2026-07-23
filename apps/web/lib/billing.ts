import { BillingInterval } from "@navaxa/db";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";
import { isPaidPlan, isBillingInterval, type PaidPlan } from "@/lib/plan-pricing";

// La aritmética de planes vive en lib/plan-pricing.ts (módulo sin `node:crypto`,
// ver el comentario de ahí). Se re-exporta para no cambiar los call sites.
export {
  PAID_PLANS,
  isPaidPlan,
  isBillingInterval,
  planPriceClp,
  periodMonths,
  planName,
  addMonths,
  type PaidPlan,
} from "@/lib/plan-pricing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
