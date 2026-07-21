-- Keys del objeto en storage detrás de cada URL de imagen. Sin ellas no se puede
-- borrar el archivo en R2 al reemplazar o quitar la imagen (las filas ya
-- existentes derivan la key desde la URL; ver lib/storage.ts).
ALTER TABLE "tenants" ADD COLUMN "logoKey" TEXT;
ALTER TABLE "tenants" ADD COLUMN "coverKey" TEXT;
ALTER TABLE "barbers" ADD COLUMN "avatarKey" TEXT;
ALTER TABLE "haircut_records" ADD COLUMN "imageKey" TEXT;
ALTER TABLE "haircut_records" ADD COLUMN "thumbnailKey" TEXT;

-- Rastro de auditoría del panel de plataforma (/admin), que opera cross-tenant.
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

CREATE INDEX "admin_audit_logs_targetType_targetId_createdAt_idx" ON "admin_audit_logs"("targetType", "targetId", "createdAt");
