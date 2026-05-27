import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import {
  processReminders24h,
  processReminders1h,
  processInactiveRecalls,
  expirePendingPayments,
  processSubscriptionRenewals,
} from "@/lib/notifications/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint para Vercel Cron o cron externo.
 * Configura headers Authorization: Bearer <CRON_SECRET> en el cron.
 *
 * Vercel cron: agregar en vercel.json:
 *   { "crons": [{ "path": "/api/webhooks/notifications?job=reminders", "schedule": "*\/15 * * * *" }] }
 */
export async function POST(req: Request) {
  // Fail-closed: sin CRON_SECRET configurado el endpoint NO se ejecuta (antes,
  // si faltaba el secreto, cualquiera podía disparar los jobs → costo de WhatsApp).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron no configurado" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const job = searchParams.get("job") ?? "reminders";

  try {
    if (job === "reminders") {
      const r = await processReminders24h();
      return NextResponse.json({ job, ...r });
    }
    if (job === "reminders1h") {
      const r = await processReminders1h();
      return NextResponse.json({ job, ...r });
    }
    if (job === "recalls") {
      const r = await processInactiveRecalls();
      return NextResponse.json({ job, ...r });
    }
    if (job === "expire_payments") {
      const r = await expirePendingPayments();
      return NextResponse.json({ job, ...r });
    }
    if (job === "renew_subscriptions") {
      const r = await processSubscriptionRenewals();
      return NextResponse.json({ job, ...r });
    }
    return NextResponse.json({ error: "Job desconocido" }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET(req: Request) {
  return POST(req);
}
