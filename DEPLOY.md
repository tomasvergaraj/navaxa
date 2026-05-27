# Despliegue en VPS (Docker, sin Vercel)

Guía para levantar navaxa en un VPS de **instancia única** con Docker Compose.
Stack: **Postgres + Next.js (standalone) + Caddy** (TLS automático). El scheduler de
notificaciones corre interno (`INTERNAL_CRON=true`), sin cron externo.

```
internet ──443──> caddy ──(red interna)──> web:3000 ──> postgres:5432
                  (TLS auto)               (Next.js)     (volumen navaxa_pg)
```

---

## 1. Prerrequisitos en el VPS

- Docker Engine + plugin Compose (`docker compose version`).
- Puertos **80 y 443** abiertos (Caddy + Let's Encrypt).
- DNS apuntando al VPS **antes** de levantar Caddy (si no, falla la emisión del cert):
  - `navaxa.cl` → **A** → IP del VPS
  - `www.navaxa.cl` → CNAME/A → IP del VPS (opcional)
  - `cdn.navaxa.cl` → al bucket R2 (dominio público/custom domain de R2) — solo si usas storage real.

## 2. Configurar el entorno

```sh
git clone https://github.com/tomasvergaraj/navaxa.git
cd navaxa
cp .env.example .env
# editar .env con valores REALES
```

Variables **críticas** para arrancar (la app falla rápido si faltan/están mal):

| Variable | Notas |
|---|---|
| `AUTH_SECRET` | ≥16 chars. `openssl rand -base64 32`. Validado al boot. |
| `POSTGRES_PASSWORD` | Contraseña fuerte (la usa el contenedor de Postgres y la URL interna). |
| `NEXT_PUBLIC_APP_URL` | `https://navaxa.cl`. **Build-time**: si lo cambias, hay que **reconstruir** la imagen. |
| `CRON_SECRET` | Token largo. El webhook de jobs es fail-closed sin esto. |

> `DATABASE_URL` del `.env` NO la usa el contenedor `web`: compose la arma desde
> `POSTGRES_*` apuntando al servicio `postgres`. La del `.env` es solo para tooling local.

## 3. Primer despliegue

```sh
docker compose --profile prod build      # construye la imagen web (ver watch-points abajo)
docker compose --profile prod up -d      # levanta postgres + web + caddy
docker compose logs -f web               # ver migraciones + arranque
```

- Las **migraciones corren solas** al arrancar `web` (`prisma migrate deploy` en el entrypoint).
  Si fallan, el contenedor sale: revisa los logs.
- Caddy pide el certificado TLS automáticamente al primer request a `https://navaxa.cl`.
- **No** corras el seed en prod (es data demo). Crea tu barbería real en `https://navaxa.cl/registrarse`.

Verifica: `https://navaxa.cl` carga, puedes registrarte e iniciar sesión.

## 4. Reemplazar los proveedores mock

Dos categorías:

**a) Solo configuración (el código ya existe, faltan llaves):**
- **Email (Resend):** `NOTIF_EMAIL_PROVIDER=resend`, `RESEND_API_KEY=...`. Verifica el dominio
  `navaxa.cl` en Resend para enviar desde `contacto@navaxa.cl` (registros SPF/DKIM en DNS).
- **Storage (Cloudflare R2):** `STORAGE_PROVIDER=r2`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL=https://cdn.navaxa.cl`.
  Apunta el DNS de `cdn.navaxa.cl` al bucket (custom domain de R2). La compresión + thumbnail
  (sharp) ya está lista y se activa al subir.
- **WhatsApp (Twilio/Meta):** `NOTIF_WHATSAPP_PROVIDER=twilio|meta` + credenciales. Feature de
  plan PRO/ENTERPRISE. Las plantillas deben aprobarse como **Utility** en Meta (no Marketing).
- **IA:** `ANTHROPIC_API_KEY=...` (gateado a PRO/ENTERPRISE; default modelo Haiku).

Tras cambiar `.env`: `docker compose --profile prod up -d` (recrea el contenedor). Si tocaste
`NEXT_PUBLIC_*`, además `build`.

**b) Requiere CÓDIGO (solo existe el mock):**
- **Pagos** (abono al reservar, `apps/web/lib/payments.ts`) y **suscripción SaaS**
  (`apps/web/lib/billing.ts`). Hay una abstracción de proveedor; falta implementar la pasarela
  real (Flow / Webpay / Mercado Pago) y seleccionarla por `PAYMENT_PROVIDER`. Esto es desarrollo,
  no solo config.

## 5. Watch-points (lo más probable de ajustar al construir)

- **sharp** (módulo nativo, para comprimir imágenes): se instala en el runner en `/deps` y se
  expone por `NODE_PATH` (el tracing de standalone no trae bien su binario de plataforma). Si al
  subir una imagen ves *"Could not load the sharp module"*, verifica que `/deps/node_modules/sharp`
  existe en el contenedor (`docker compose exec web ls /deps/node_modules`) y que se borró la copia
  incompleta. Alternativa si diera problemas: instalar sharp directo en el standalone o pasar a un
  runtime no-standalone (`next start` con node_modules completo).
- **Prisma engine en Alpine:** el schema ya incluye `binaryTargets` musl y el runner trae `openssl`.
  Si `migrate deploy` falla por el engine, confirmar que la imagen es alpine/musl.
- **`AUTH_SECRET`:** si el contenedor `web` se reinicia en loop al arrancar, casi seguro es
  `AUTH_SECRET` ausente o < 16 chars (se valida al boot). Revisa `docker compose logs web`.

## 6. Comandos útiles

```sh
docker compose --profile prod up -d --build web      # actualizar tras git pull
docker compose logs -f web caddy                     # logs
docker compose exec web prisma migrate deploy \
  --schema=./packages/db/prisma/schema.prisma        # migrar a mano
docker compose exec postgres psql -U navaxa navaxa   # consola SQL
docker compose exec postgres pg_dump -U navaxa navaxa > backup.sql   # backup
docker compose down                                  # bajar (los datos persisten en el volumen)
```

## 7. Actualizaciones

```sh
git pull
docker compose --profile prod build web
docker compose --profile prod up -d        # las migraciones nuevas corren al recrear web
```

Los datos de Postgres persisten en el volumen `navaxa_pg` (haz backups regulares). El dominio,
IG (`navaxa.app`) y email (`contacto@navaxa.cl`) ya están reconciliados en el código a `navaxa.cl`.
