-- Nombre del local en Google Maps (se cachea junto al rating) para mostrar
-- en Configuración qué lugar quedó vinculado sin exponer el Place ID.
ALTER TABLE "tenants" ADD COLUMN "googlePlaceName" TEXT;
