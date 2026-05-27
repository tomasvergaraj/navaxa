#!/bin/sh
set -e

# Aplica migraciones pendientes antes de arrancar (instancia única en VPS).
# Si falla, el contenedor sale (no arrancamos con un esquema desactualizado).
echo "[entrypoint] prisma migrate deploy…"
prisma migrate deploy --schema=./packages/db/prisma/schema.prisma

echo "[entrypoint] Iniciando Next (standalone)…"
exec node apps/web/server.js
