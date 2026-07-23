import { NextResponse } from "next/server";
import { prisma, Plan } from "@navaxa/db";
import { ApiError, apiError, requireManager } from "@/lib/api-errors";
import { isPaidPlan, isBillingInterval, signBillingToken, buildBillingCheckoutUrl } from "@/lib/billing";
import {
  deleteOneclickInscription,
  oneclickEnabled,
  startOneclickInscription,
} from "@/lib/oneclick";
import {
  chargeSubscriptionRenewal,
  oneclickUsernameFor,
  CHARGEABLE_SELECT,
} from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Acciones de facturación del dueño:
 *  - checkout: inicia el cobro de un plan (devuelve checkoutUrl al mock).
 *  - cancel: cancela al final del período (mantiene acceso hasta entonces).
 *  - reactivate: deshace una cancelación pendiente.
 *  - card_inscribe: inicia la inscripción de tarjeta en Oneclick (cobro automático).
 *  - card_remove: borra la inscripción en Transbank y acá.
 *  - charge_now: reintenta el cobro pendiente con la tarjeta inscrita.
 */
export async function POST(req: Request) {
  try {
    const { tenantId, userId } = await requireManager();

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      plan?: string;
      interval?: string;
    };

    if (body.action === "checkout") {
      const plan = body.plan ?? "";
      if (!isPaidPlan(plan)) {
        return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
      }
      const interval = isBillingInterval(body.interval ?? "") ? (body.interval as "MONTHLY" | "ANNUAL") : "MONTHLY";
      const token = signBillingToken(tenantId, plan, interval);
      return NextResponse.json({ checkoutUrl: buildBillingCheckoutUrl(token) });
    }

    if (body.action === "cancel") {
      const sub = await prisma.subscription.findUnique({ where: { tenantId } });
      // Con período vigente: cancelar al final. Sin período: bajar a FREE ya.
      if (sub && sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
        await prisma.subscription.update({
          where: { tenantId },
          data: { cancelAtPeriodEnd: true },
        });
        return NextResponse.json({ ok: true, cancelAtPeriodEnd: true });
      }
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { tenantId },
          create: { tenantId, plan: Plan.FREE, status: "CANCELED" },
          update: { plan: Plan.FREE, status: "CANCELED", cancelAtPeriodEnd: false, currentPeriodEnd: null },
        }),
        prisma.tenant.update({ where: { id: tenantId }, data: { plan: Plan.FREE } }),
      ]);
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: false });
    }

    if (body.action === "reactivate") {
      await prisma.subscription.updateMany({
        where: { tenantId, cancelAtPeriodEnd: true },
        data: { cancelAtPeriodEnd: false },
      });
      return NextResponse.json({ ok: true });
    }

    // ---- Cobro automático (Webpay Oneclick) ----

    if (body.action === "card_inscribe") {
      if (!oneclickEnabled()) {
        throw new ApiError(503, "El cobro automático no está disponible por ahora");
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user?.email) throw new ApiError(400, "Tu usuario no tiene email");

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });
      const username = oneclickUsernameFor(tenantId);

      const started = await startOneclickInscription({
        username,
        email: user.email,
        responseUrl: `${APP_URL}/api/billing/oneclick/return`,
      });

      // El token es la ÚNICA pista que trae el return de Transbank: sin esta
      // fila no hay forma de saber a qué tenant pertenece la inscripción.
      await prisma.subscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          plan: tenant?.plan ?? Plan.FREE,
          oneclickUsername: username,
          oneclickToken: started.token,
        },
        update: { oneclickUsername: username, oneclickToken: started.token },
      });

      return NextResponse.json({
        oneclick: { url: started.url_webpay, token: started.token },
      });
    }

    if (body.action === "card_remove") {
      const sub = await prisma.subscription.findUnique({
        where: { tenantId },
        select: { oneclickTbkUser: true, oneclickUsername: true },
      });
      if (sub?.oneclickTbkUser && sub.oneclickUsername) {
        try {
          await deleteOneclickInscription({
            tbkUser: sub.oneclickTbkUser,
            username: sub.oneclickUsername,
          });
        } catch (e) {
          // Si Transbank ya no la tiene, igual la soltamos de nuestro lado: dejar
          // un tbk_user muerto guardado solo produce cobros que fallan.
          console.error("[billing] no se pudo borrar la inscripción Oneclick:", (e as Error).message);
        }
      }
      await prisma.subscription.updateMany({
        where: { tenantId },
        data: {
          oneclickTbkUser: null,
          oneclickToken: null,
          cardBrand: null,
          cardLast4: null,
          cardInscribedAt: null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "charge_now") {
      const sub = await prisma.subscription.findUnique({
        where: { tenantId },
        select: CHARGEABLE_SELECT,
      });
      if (!sub) throw new ApiError(404, "No hay suscripción");
      if (!sub.oneclickTbkUser) throw new ApiError(400, "No hay tarjeta inscrita");
      if (sub.plan === Plan.FREE) throw new ApiError(400, "El plan Gratis no se cobra");
      // Sin período no hay ciclo que identificar, y el ciclo es la clave de
      // idempotencia: dos clicks seguidos cobrarían dos veces.
      if (!sub.currentPeriodEnd) throw new ApiError(400, "No hay un período por renovar");

      // `force` salta el cooldown entre reintentos: acá el cobro lo pidió una
      // persona, no el cron.
      const res = await chargeSubscriptionRenewal(sub, { force: true });
      if (!res.ok) throw new ApiError(402, res.reason);
      return NextResponse.json({ ok: true, periodEnd: res.periodEnd.toISOString() });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
