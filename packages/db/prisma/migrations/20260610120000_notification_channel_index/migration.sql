-- Cupo mensual de WhatsApp: el chequeo cuenta envíos por tenant+canal+mes en
-- cada notificación (hot path), así que necesita su propio índice.
CREATE INDEX "notification_logs_tenantId_channel_createdAt_idx" ON "notification_logs"("tenantId", "channel", "createdAt");
