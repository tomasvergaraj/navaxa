# CLAUDE.md

Guía para Claude Code trabajando en **navaxa** (SaaS para barberías). Stack y setup en [README.md](README.md).

## Importante: costos

**Antes de escribir código que llame a APIs externas (Anthropic, WhatsApp, email, storage, BD), lee [COSTS.md](COSTS.md) y aplica sus reglas** sin pedir confirmación. Resumen:

- **IA Anthropic**: default **Haiku 4.5** (`claude-haiku-4-5`); nunca Sonnet/Opus sin justificación. `max_tokens` al mínimo necesario.
- **WhatsApp** (el grueso del costo a escala): templates como **Utility**, no Marketing; idempotencia vía `NotificationLog`; es feature de plan PRO (degradar a email en FREE/STARTER).
- **Storage**: comprimir imágenes + generar thumbnail antes de subir a R2.
- **BD (Neon)**: índice por cada `where` nuevo en hot path; paginar todo `findMany` que pueda superar ~100 filas; nada de polling agresivo.

## Convenciones que evitan bugs

- **Multi-tenancy**: usa `scopedDb()` ([apps/web/lib/tenant.ts](apps/web/lib/tenant.ts)) para que el filtro `tenantId` se inyecte automáticamente en cada query. **Excepción**: el modelo `Tenant` no tiene columna `tenantId` — para leerlo o actualizarlo usa el `prisma` crudo, NO `scopedDb` (si no, inyecta `tenantId` y la query rompe).
- **Tipos en cero**: `tsc --noEmit` debe quedar sin errores antes de dar un cambio por terminado. Verifica con `corepack pnpm --filter web exec tsc --noEmit`.
- **Pagos**: tanto el abono al reservar ([lib/payments.ts](apps/web/lib/payments.ts)) como la suscripción SaaS ([lib/billing.ts](apps/web/lib/billing.ts)) usan un proveedor **mock**; la pasarela real se enchufa por la abstracción ya existente.
- **Tokens stateless**: gestión de reservas, pagos y links de invitación/reset usan tokens HMAC firmados con `AUTH_SECRET` (no hay tabla de sesión para esos flujos públicos).

## Commits

- Mensajes de commit **sin** el trailer `Co-Authored-By`.
- Los `.env` están gitignoreados — nunca subir secretos. `docker-compose.override.yml` es un override local por máquina y también está ignorado.

## Dev local (Windows, esta máquina)

- `pnpm` no está en PATH: usar `corepack pnpm ...`. Turbo no encuentra el binario, así que corre el dev del web directo: `corepack pnpm --filter web dev`.
- Para migrar Prisma, **detén el dev server primero** (en Windows bloquea el DLL del query engine y `generate` falla con EPERM).
- Postgres se expone en `127.0.0.1:55432` vía `docker-compose.override.yml`; ese puerto está en `DATABASE_URL`.
