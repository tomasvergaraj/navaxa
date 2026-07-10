-- Reseñas de Google en el perfil público: Place ID + cache diario de rating/reseñas.
ALTER TABLE "tenants"
  ADD COLUMN "googlePlaceId" TEXT,
  ADD COLUMN "googleRating" DOUBLE PRECISION,
  ADD COLUMN "googleReviewCount" INTEGER,
  ADD COLUMN "googleReviews" JSONB,
  ADD COLUMN "googleMapsUri" TEXT,
  ADD COLUMN "googleSyncedAt" TIMESTAMP(3);
