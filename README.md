# navaxa

> El sistema operativo para barberías que recuerdan a cada cliente.

CRM visual con historial de cortes en imágenes, agenda con disponibilidad real, comisiones por barbero, automatizaciones por WhatsApp/email y recomendación de próximo corte con IA.

## Stack

- **Next.js 14** (App Router) — frontend + API routes
- **TypeScript** estricto
- **Tailwind CSS** + **shadcn/ui** — UI system
- **PostgreSQL** + **Prisma** — datos, compatible con Neon
- **Auth.js v5** (JWT) — multi-tenancy nativo
- **Cloudflare R2** / S3-compatible — storage de imágenes
- **Anthropic Claude** — recomendación IA
- **Twilio / Resend** — WhatsApp y email (con mocks para dev)
- **Turborepo** + **pnpm** — monorepo
- **Docker** + **Caddy** — deploy en VPS

## Estructura

```
navaxa/
├── apps/web/                Next.js app
│   ├── app/                  rutas (marketing, auth, dashboard, api)
│   ├── components/           componentes React
│   ├── lib/                  dominio, servicios, infra
│   └── middleware.ts         tenant + auth
├── packages/
│   ├── db/                   Prisma schema, client, seed
│   ├── ui/                   componentes shadcn compartidos
│   └── config/               env validation, constantes
├── docker-compose.yml
└── Caddyfile
```

## Inicio rápido

### Requisitos

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- Docker (para Postgres local) o Postgres 16+ directo

### Instalar

```bash
pnpm install
cp .env.example .env
# editar .env con tus valores
```

> En dev sin Docker, Next y Prisma leen el `.env` de cada paquete, no el de la raíz.
> Copia tu `.env` a `apps/web/.env` y `packages/db/.env` (mantenlos en sync).
> Con Docker (perfil prod) el `.env` de la raíz alimenta el compose y no hace falta copiarlo.

### Base de datos

```bash
# levantar postgres en docker
docker compose up -d postgres

# generar cliente prisma
pnpm db:generate

# correr migraciones (crea tablas)
pnpm db:migrate

# poblar con datos de prueba
pnpm db:seed
```

### Desarrollo

```bash
pnpm dev
```

Abre `http://localhost:3000`.

**Credenciales del seed:**
- `pepe@donpepe.cl` / `navaxa123` — owner
- `rodrigo@donpepe.cl` / `navaxa123` — barbero
- `matias@donpepe.cl` / `navaxa123` — barbero
- `felipe@donpepe.cl` / `navaxa123` — barbero

## Despliegue

### Vercel (recomendado para frontend)

1. Conecta el repo en Vercel.
2. Configura:
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && pnpm db:generate && pnpm --filter web build`
   - **Install Command**: `pnpm install --frozen-lockfile`
3. Variables de entorno: copia de `.env.example` con valores reales. `DATABASE_URL` apuntando a [Neon](https://neon.tech).
4. Después del primer deploy, corre `pnpm db:deploy && pnpm db:seed` con `DATABASE_URL` apuntando a Neon.

### VPS (Ubuntu 22.04+, full Docker)

```bash
git clone <repo> /opt/navaxa && cd /opt/navaxa
cp .env.example .env
# edita .env con valores de producción (incluyendo DOMAIN)
docker compose --profile prod up -d --build
docker compose exec web sh -c "cd packages/db && pnpm prisma migrate deploy"
docker compose exec web sh -c "cd packages/db && pnpm exec tsx prisma/seed.ts"
```

Apunta tu DNS al VPS. Caddy emite TLS automáticamente.

### Cloudflare Pages

La app es compatible con Pages vía `@cloudflare/next-on-pages`, pero los uploads de imágenes requieren mover a signed URLs directos al bucket R2. Recomendación: usar Vercel para la app y Cloudflare R2 + CDN como capa de archivos estáticos.

## Comandos útiles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm db:studio` | Prisma Studio (GUI de BD) |
| `pnpm db:reset` | Borra y vuelve a crear la BD |
| `pnpm db:seed` | Pobla con datos de prueba |
| `pnpm typecheck` | Chequeo de tipos |
| `pnpm lint` | Linter |

## Multi-tenancy

Cada barbería es un `Tenant`. La columna `tenantId` está en todos los modelos relevantes. El helper `scopedDb()` en `apps/web/lib/tenant.ts` extiende Prisma para inyectar el filtro automáticamente en cada query — imposible escribir un route handler que filtre el tenant equivocado.

## IA: recomendación de próximo corte

Endpoint `POST /api/ai/recommend` con `{ clientId }`. Lee el historial de cortes (últimos 8) + preferencias + ratings y pide a Claude una sugerencia estructurada en JSON. Cachea la respuesta en `ai_recommendations` para feedback loop.

## Licencia

UNLICENSED — código de propiedad. Para uso comercial contactar al autor.
