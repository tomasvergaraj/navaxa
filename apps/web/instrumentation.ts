/**
 * Scheduler interno opcional para disparar las notificaciones sin cron externo.
 * Se activa con INTERNAL_CRON=true (ideal en VPS de una sola instancia).
 * En Vercel/serverless déjalo apagado y usa vercel.json (ver crons).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Valida las variables de entorno al arrancar el servidor: falla rápido si
  // AUTH_SECRET falta o es < 16 chars (la firma HMAC/JWT quedaría débil), o si
  // DATABASE_URL no es válida. Sin esto, getEnv() nunca se ejecutaba y el guard
  // de fortaleza era inerte.
  const { getEnv } = await import("@navaxa/config");
  getEnv();

  if (process.env.INTERNAL_CRON !== "true") return;

  const g = globalThis as unknown as { __navaxaCronStarted?: boolean };
  if (g.__navaxaCronStarted) return;
  g.__navaxaCronStarted = true;

  const {
    processReminders24h,
    processReminders1h,
    processInactiveRecalls,
    expirePendingPayments,
    processSubscriptionRenewals,
  } = await import("@/lib/notifications/jobs");
  const { syncAllGoogleReviews } = await import("@/lib/google-reviews");

  const intervalMs = Number(process.env.CRON_INTERVAL_MS ?? 15 * 60 * 1000);

  // Recordatorios (24h + 1h) y expiración de abonos sin pagar, cada intervalo.
  setInterval(async () => {
    try {
      const a = await processReminders24h();
      const b = await processReminders1h();
      if (a.processed || b.processed) {
        console.log(`[cron] recordatorios enviados — 24h:${a.processed} 1h:${b.processed}`);
      }
    } catch (e) {
      console.error("[cron] error en recordatorios:", (e as Error).message);
    }
    try {
      const e = await expirePendingPayments();
      if (e.expired) console.log(`[cron] abonos expirados — ${e.expired}`);
    } catch (e) {
      console.error("[cron] error expirando abonos:", (e as Error).message);
    }
  }, intervalMs);

  // Reactivación de inactivos, renovación de suscripciones y reseñas Google, una vez al día.
  setInterval(
    async () => {
      try {
        const r = await processInactiveRecalls();
        if (r.sent) console.log(`[cron] reactivaciones enviadas — ${r.sent}`);
      } catch (e) {
        console.error("[cron] error en reactivaciones:", (e as Error).message);
      }
      try {
        const r = await processSubscriptionRenewals();
        if (r.downgraded || r.pastDue) {
          console.log(`[cron] suscripciones — bajadas:${r.downgraded} vencidas:${r.pastDue}`);
        }
      } catch (e) {
        console.error("[cron] error renovando suscripciones:", (e as Error).message);
      }
      try {
        const gr = await syncAllGoogleReviews();
        if (gr.synced || gr.failed) {
          console.log(`[cron] reseñas Google — ok:${gr.synced} error:${gr.failed}`);
        }
      } catch (e) {
        console.error("[cron] error sincronizando reseñas Google:", (e as Error).message);
      }
    },
    24 * 60 * 60 * 1000,
  );

  console.log(`[cron] scheduler interno iniciado (intervalo ${intervalMs}ms)`);
}
