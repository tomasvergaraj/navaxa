-- Revocación de sesiones JWT: corte por usuario. Todo token emitido antes de
-- esta marca deja de valer (se bumpea al cambiar clave/rol o desactivar cuenta).
-- Nullable y sin default: los usuarios existentes no pierden su sesión al migrar.
ALTER TABLE "users" ADD COLUMN "sessionInvalidBefore" TIMESTAMP(3);
