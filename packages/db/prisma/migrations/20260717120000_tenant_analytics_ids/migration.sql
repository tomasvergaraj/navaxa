-- IDs de analítica del sitio público (Google Analytics 4 y Meta Pixel).
-- Feature de plan PRO+: el storefront solo inyecta los scripts si el plan lo permite.
ALTER TABLE "tenants" ADD COLUMN "gaMeasurementId" TEXT;
ALTER TABLE "tenants" ADD COLUMN "metaPixelId" TEXT;
