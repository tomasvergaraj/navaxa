import { NextResponse } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
