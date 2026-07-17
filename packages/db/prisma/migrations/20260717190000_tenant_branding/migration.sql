-- Personalización del sitio público: color de marca (PRO+) y opt-out del
-- marketplace (índice público /reservar).
ALTER TABLE "tenants" ADD COLUMN "brandColor" TEXT;
ALTER TABLE "tenants" ADD COLUMN "marketplaceVisible" BOOLEAN NOT NULL DEFAULT true;
