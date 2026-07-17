#!/usr/bin/env bash
# Dispara manualmente un job del endpoint de cron de navaxa (app en :3004).
# Uso: cron-jobs.sh <reminders|reminders1h|expire_payments|renew_subscriptions|recalls|birthdays>
#
# OJO: NO agendar esto en crontab — la app ya trae scheduler interno
# (instrumentation.ts, INTERNAL_CRON=true en compose) y un cron externo
# duplica los disparos. Este script es solo para pruebas/disparos a mano.
# El secreto se lee de .env para no exponerlo en la línea de comandos.
set -euo pipefail

JOB="${1:?uso: cron-jobs.sh <job>}"
ENV_FILE="/var/www/navaxa/.env"

CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')"
if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET no configurado en $ENV_FILE" >&2
  exit 1
fi

curl -sS -m 55 -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:3004/api/webhooks/notifications?job=$JOB"
echo
