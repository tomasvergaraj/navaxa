/**
 * Cobro recurrente de la suscripción SaaS con Webpay Oneclick.
 *
 * Antes de esto la renovación era manual: el job solo marcaba PAST_DUE y el
 * dueño tenía que volver a pagar one-shot por el link de facturación. Con la
 * tarjeta inscrita (ver lib/oneclick.ts) el cobro ocurre solo.
 *
 * Reglas que importan porque acá se mueve dinero real:
 *  - Idempotencia por ciclo: `subscription_charges` tiene UNIQUE
 *    (subscriptionId, periodEnd, attempt) y la fila se crea PENDING ANTES de
 *    llamar a Transbank. Dos corridas del cron en paralelo → la segunda choca
 *    contra el índice y se va, en vez de cobrar dos veces.
 *  - Reconciliación: si el proceso muere entre el POST y el guardado, la fila
 *    queda PENDING. La corrida siguiente pregunta el estado a Transbank por
 *    buy_order antes de decidir nada.
 *  - Reintento con buy_order nuevo: Transbank rechaza un buy_order repetido,
 *    así que cada intento lleva el suyo (sufijo del número de intento).
 */

import {
  prisma,
  Plan,
  SubscriptionStatus,
  BillingInterval,
  NotificationChannel,
} from "@navaxa/db";
// De plan-pricing, NO de lib/billing: éste corre desde el job, que webpack
// bundlea también para Edge, y billing.ts arrastra `node:crypto`.
import { addMonths, periodMonths, planPriceClp, planName, isPaidPlan } from "@/lib/plan-pricing";
import {
  authorizeOneclickCharge,
  getOneclickChargeStatus,
  ONECLICK_LIMITS,
  type OneclickAuthorized,
} from "@/lib/oneclick";
import { sendNotification } from "@/lib/notifications";
import { formatCLP } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Intentos de cobro antes de bajar la cuenta a Gratis. */
export const MAX_RENEWAL_ATTEMPTS = 3;

/** Horas mínimas entre reintentos (el cron diario ya espacía, esto es el guard). */
const RETRY_COOLDOWN_HOURS = 20;

export const CHARGE_STATUS = {
  pending: "PENDING",
  authorized: "AUTHORIZED",
  failed: "FAILED",
} as const;

export type ChargeOutcome =
  | { ok: true; alreadyCharged?: boolean; periodEnd: Date; authorizationCode?: string }
  | { ok: false; reason: string; suspended?: boolean; retryable?: boolean };

/** Datos de la suscripción que necesita el cobro. */
type ChargeableSubscription = {
  id: string;
  tenantId: string;
  plan: Plan;
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  oneclickUsername: string | null;
  oneclickTbkUser: string | null;
  cardLast4: string | null;
  renewalAttempts: number;
  lastRenewalAttemptAt: Date | null;
};

export const CHARGEABLE_SELECT = {
  id: true,
  tenantId: true,
  plan: true,
  billingInterval: true,
  status: true,
  currentPeriodEnd: true,
  oneclickUsername: true,
  oneclickTbkUser: true,
  cardLast4: true,
  renewalAttempts: true,
  lastRenewalAttemptAt: true,
} as const;

/** `username` estable que mandamos a Transbank por tenant (máx. 40 chars). */
export function oneclickUsernameFor(tenantId: string): string {
  return `nx_${tenantId}`.slice(0, ONECLICK_LIMITS.username);
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * buy_order determinista por (suscripción, ciclo, intento). Máx. 26 chars:
 * "nxr" + 10 + 8 + "a" + n ≈ 23.
 */
export function renewalBuyOrder(subscriptionId: string, cycleEnd: Date, attempt: number): string {
  return `nxr${subscriptionId.slice(-10)}${ymd(cycleEnd)}a${attempt}`.slice(
    0,
    ONECLICK_LIMITS.buyOrder,
  );
}

/** El detalle "hijo" del cobro es el que dice si se autorizó de verdad. */
function chargeApproved(res: OneclickAuthorized): boolean {
  const d = res.details?.[0];
  return !!d && d.response_code === 0 && d.status === "AUTHORIZED";
}

/**
 * Cobra la renovación de una suscripción. No valida que el período esté
 * vencido: eso lo decide quien llama (el job, o el botón "cobrar ahora").
 */
export async function chargeSubscriptionRenewal(
  sub: ChargeableSubscription,
  opts: { force?: boolean } = {},
): Promise<ChargeOutcome> {
  if (!isPaidPlan(sub.plan)) {
    return { ok: false, reason: "El plan Gratis no se cobra" };
  }
  if (!sub.oneclickTbkUser || !sub.oneclickUsername) {
    return { ok: false, reason: "No hay tarjeta inscrita", retryable: true };
  }

  const now = new Date();

  // Cooldown: evita que dos corridas del cron el mismo día quemen los 3 intentos.
  if (!opts.force && sub.lastRenewalAttemptAt) {
    const hours = (now.getTime() - sub.lastRenewalAttemptAt.getTime()) / 3_600_000;
    if (hours < RETRY_COOLDOWN_HOURS) {
      return { ok: false, reason: "Reintento en espera", retryable: true };
    }
  }

  // El ciclo se identifica por el fin del período que estamos renovando.
  const cycleEnd = sub.currentPeriodEnd ?? now;
  const amount = planPriceClp(sub.plan, sub.billingInterval);
  const attempt = sub.renewalAttempts + 1;

  // ¿Ya se cobró este ciclo? (crash después del cobro, o doble corrida).
  const existing = await prisma.subscriptionCharge.findMany({
    where: { subscriptionId: sub.id, periodEnd: cycleEnd },
    orderBy: { attempt: "desc" },
  });

  const authorized = existing.find((c) => c.status === CHARGE_STATUS.authorized);
  if (authorized) {
    // El dinero ya se movió: solo falta reflejar el período (idempotente).
    const periodEnd = await applySuccessfulCharge(sub, now, { replay: true });
    return { ok: true, alreadyCharged: true, periodEnd, authorizationCode: authorized.authorizationCode ?? undefined };
  }

  // Filas PENDING de una corrida que se cayó: preguntar a Transbank qué pasó.
  for (const stale of existing.filter((c) => c.status === CHARGE_STATUS.pending)) {
    const reconciled = await reconcilePendingCharge(sub, stale.id, stale.buyOrder, now);
    if (reconciled) return reconciled;
  }

  if (attempt > MAX_RENEWAL_ATTEMPTS) {
    await suspendSubscription(sub, "Se agotaron los intentos de cobro");
    return { ok: false, reason: "Se agotaron los intentos de cobro", suspended: true };
  }

  const buyOrder = renewalBuyOrder(sub.id, cycleEnd, attempt);

  // Marca de intento ANTES de llamar: si el POST se pierde, la fila PENDING es
  // el único rastro que permite reconciliar en vez de recobrar.
  let chargeId: string;
  try {
    const row = await prisma.subscriptionCharge.create({
      data: {
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        buyOrder,
        attempt,
        periodEnd: cycleEnd,
        amount,
        plan: sub.plan,
        billingInterval: sub.billingInterval,
        status: CHARGE_STATUS.pending,
        cardLast4: sub.cardLast4,
      },
      select: { id: true },
    });
    chargeId = row.id;
  } catch {
    // Choque con el UNIQUE: otra corrida tomó este intento.
    return { ok: false, reason: "Cobro ya en curso", retryable: true };
  }

  let res: OneclickAuthorized;
  try {
    res = await authorizeOneclickCharge({
      username: sub.oneclickUsername,
      tbkUser: sub.oneclickTbkUser,
      buyOrder,
      amount,
    });
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    // Error de red/HTTP: no sabemos si Transbank alcanzó a cobrar. La fila queda
    // PENDING a propósito, para que la próxima corrida reconcilie por buy_order.
    await prisma.$transaction([
      prisma.subscriptionCharge.update({
        where: { id: chargeId },
        data: { errorMessage: message },
      }),
      prisma.subscription.update({
        where: { id: sub.id },
        data: { lastRenewalAttemptAt: now, lastRenewalError: message },
      }),
    ]);
    console.error(`[billing] cobro Oneclick falló tenant=${sub.tenantId}: ${message}`);
    return { ok: false, reason: "No se pudo contactar a Transbank", retryable: true };
  }

  const detail = res.details?.[0];
  if (!chargeApproved(res)) {
    const reason = detail
      ? `Rechazado por el emisor (código ${detail.response_code})`
      : "Rechazado por Transbank";
    await prisma.$transaction([
      prisma.subscriptionCharge.update({
        where: { id: chargeId },
        data: {
          status: CHARGE_STATUS.failed,
          responseCode: detail?.response_code ?? null,
          errorMessage: reason,
        },
      }),
      prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          renewalAttempts: attempt,
          lastRenewalAttemptAt: now,
          lastRenewalError: reason,
        },
      }),
    ]);

    if (attempt >= MAX_RENEWAL_ATTEMPTS) {
      await suspendSubscription(sub, reason);
      return { ok: false, reason, suspended: true };
    }
    await notifyOwner(sub, "subscription_charge_failed", { amount });
    return { ok: false, reason, retryable: true };
  }

  await prisma.subscriptionCharge.update({
    where: { id: chargeId },
    data: {
      status: CHARGE_STATUS.authorized,
      responseCode: detail?.response_code ?? 0,
      authorizationCode: detail?.authorization_code ?? null,
      cardLast4: last4(res.card_detail?.card_number) ?? sub.cardLast4,
    },
  });

  const periodEnd = await applySuccessfulCharge(sub, now);
  await notifyOwner(sub, "subscription_charged", {
    amount,
    periodEnd,
    authorizationCode: detail?.authorization_code ?? "—",
  });

  return { ok: true, periodEnd, authorizationCode: detail?.authorization_code };
}

/**
 * Fila PENDING de una corrida caída: Transbank es la fuente de verdad. Devuelve
 * el resultado si quedó resuelta, o null si nunca se cobró (se puede reintentar).
 */
async function reconcilePendingCharge(
  sub: ChargeableSubscription,
  chargeId: string,
  buyOrder: string,
  now: Date,
): Promise<ChargeOutcome | null> {
  let status: OneclickAuthorized | null;
  try {
    status = await getOneclickChargeStatus(buyOrder);
  } catch (e) {
    // No pudimos preguntar: NO reintentamos (podríamos cobrar dos veces).
    console.error(`[billing] no se pudo reconciliar ${buyOrder}: ${(e as Error).message}`);
    return { ok: false, reason: "Cobro pendiente de reconciliar", retryable: true };
  }

  if (!status) {
    // Transbank no la conoce: nunca se cobró. Cerramos la fila como fallida
    // para que el intento siguiente use un buy_order nuevo.
    await prisma.subscriptionCharge.update({
      where: { id: chargeId },
      data: { status: CHARGE_STATUS.failed, errorMessage: "Sin registro en Transbank" },
    });
    return null;
  }

  const detail = status.details?.[0];
  if (!chargeApproved(status)) {
    await prisma.subscriptionCharge.update({
      where: { id: chargeId },
      data: {
        status: CHARGE_STATUS.failed,
        responseCode: detail?.response_code ?? null,
        errorMessage: "Rechazado (reconciliado)",
      },
    });
    return null;
  }

  await prisma.subscriptionCharge.update({
    where: { id: chargeId },
    data: {
      status: CHARGE_STATUS.authorized,
      responseCode: detail?.response_code ?? 0,
      authorizationCode: detail?.authorization_code ?? null,
    },
  });
  const periodEnd = await applySuccessfulCharge(sub, now, { replay: true });
  return { ok: true, alreadyCharged: true, periodEnd, authorizationCode: detail?.authorization_code };
}

/**
 * Refleja un cobro exitoso: extiende el período, deja la suscripción ACTIVE y
 * asegura que el tenant tenga el plan.
 *
 * `replay` distingue los dos usos. En replay (cobro que ya estaba autorizado en
 * la BD o que se reconcilió contra Transbank) un período vigente significa que
 * otra corrida ya lo aplicó → no se toca. En un cobro fresco siempre hay que
 * extender, aunque el período esté vigente (renovación anticipada): si no, el
 * dinero se movió y el dueño no recibió nada.
 */
async function applySuccessfulCharge(
  sub: ChargeableSubscription,
  now: Date,
  opts: { replay?: boolean } = {},
): Promise<Date> {
  const current = sub.currentPeriodEnd;
  if (opts.replay && current && current > now && sub.status === SubscriptionStatus.ACTIVE) {
    return current; // ya aplicado por otra corrida
  }
  // Base del período nuevo: el vencimiento vigente si aún no pasa (renovación
  // anticipada, no se pierden días), o hoy si ya estaba vencido — durante la
  // mora la cuenta siguió funcionando, no corresponde cobrar días ya usados.
  const base = current && current > now ? current : now;
  const periodEnd = addMonths(base, periodMonths(sub.billingInterval));

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        lastPaymentAt: now,
        renewalAttempts: 0,
        lastRenewalAttemptAt: now,
        lastRenewalError: null,
        provider: "oneclick",
      },
    }),
    prisma.tenant.update({ where: { id: sub.tenantId }, data: { plan: sub.plan } }),
  ]);

  return periodEnd;
}

/** Se agotaron los intentos: la cuenta baja a Gratis (la tarjeta se conserva). */
async function suspendSubscription(sub: ChargeableSubscription, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        plan: Plan.FREE,
        currentPeriodEnd: null,
        lastRenewalError: reason,
      },
    }),
    prisma.tenant.update({ where: { id: sub.tenantId }, data: { plan: Plan.FREE } }),
  ]);
  await notifyOwner(sub, "subscription_suspended", { amount: planPriceClp(sub.plan, sub.billingInterval) });
}

function last4(masked?: string | null): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * Avisos de facturación al dueño. Siempre por email: son mensajes del SaaS a su
 * cliente, no del tenant a los suyos, así que no consumen su cupo de WhatsApp
 * ni dependen de un template aprobado por Meta.
 */
async function notifyOwner(
  sub: ChargeableSubscription,
  templateKey: "subscription_charged" | "subscription_charge_failed" | "subscription_suspended",
  data: { amount: number; periodEnd?: Date; authorizationCode?: string },
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: sub.tenantId },
    select: {
      name: true,
      email: true,
      users: {
        where: { role: "OWNER", active: true },
        select: { email: true },
        take: 1,
      },
    },
  });
  const to = tenant?.email || tenant?.users[0]?.email;
  if (!to) return;

  await sendNotification({
    tenantId: sub.tenantId,
    channel: NotificationChannel.EMAIL,
    recipient: to,
    templateKey,
    data: {
      shopName: tenant?.name ?? "tu barbería",
      planName: planName(sub.plan),
      amount: formatCLP(data.amount),
      cardLast4: sub.cardLast4 ?? "····",
      periodEnd: data.periodEnd
        ? data.periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
        : "—",
      authorizationCode: data.authorizationCode ?? "—",
      actionUrl: `${APP_URL}/configuracion?tab=plan`,
    },
  });
}
