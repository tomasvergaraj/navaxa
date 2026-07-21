# Despliegue en VPS (Docker + nginx + Cloudflare)

Guía para levantar navaxa en el VPS. Este VPS es **compartido** (hospeda otros sitios),
así que el edge HTTP/TLS lo hace el **nginx del host** con cert **Origin de Cloudflare**,
NO Caddy. El scheduler de notificaciones corre interno (`INTERNAL_CRON=true`), sin cron externo.

```
internet ─443─> Cloudflare ─443─> nginx (host) ─> 127.0.0.1:3004 ─> web (Next.js) ─> postgres
              (proxied,             (TLS: cert      (docker)          (docker)         (volumen
               Full strict)          Origin CF)                                        navaxa_pg)
```

> Nota: el repo incluye un servicio `caddy` (profile `prod`) para el caso de un VPS de
> **instancia única** donde Caddy posee los puertos 80/443. En este VPS NO se usa: nginx ya
> ocupa 80/443. Por eso desplegamos **sin** `--profile prod` y fronteamos con nginx.

---

## 1. Prerrequisitos en el VPS

- Docker Engine + plugin Compose (`docker compose version`).
- nginx del host con su patrón de vhosts en `/etc/nginx/sites-available` + symlink a `sites-enabled`.
- Un puerto local libre para `web` (en este VPS el 3000 ya está ocupado → usamos **3004**).
- DNS + cert manejados por Cloudflare (ver paso 4).

## 2. Configurar el entorno

```sh
cd /var/www/navaxa
cp .env.example .env
# editar .env con valores REALES (genera secretos con openssl)
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

### Override de este VPS (`docker-compose.override.yml`, gitignored)

Para no chocar con el resto del VPS, hay un override local que (a) deja Caddy fuera —no
activamos su profile— y (b) publica `web` en un puerto libre del host:

```yaml
services:
  web:
    ports: !override          # !override REEMPLAZA la lista (compose hace append por defecto;
      - "127.0.0.1:3004:3000" # sin esto bindea también el 3000 base y falla por estar ocupado)
```

## 3. Primer despliegue

```sh
docker compose build web      # construye la imagen web (ver watch-points abajo)
docker compose up -d          # levanta SOLO postgres + web (sin caddy, no hay --profile prod)
docker compose logs -f web    # ver migraciones + arranque
```

- Las **migraciones corren solas** al arrancar `web` (`prisma migrate deploy` en el entrypoint).
  Si fallan, el contenedor sale: revisa los logs.
- **No** corras el seed en prod (es data demo). Crea tu barbería real en `https://navaxa.cl/registro`.

Verifica local: `curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3004/` → `200`.

## 4. Edge: DNS, TLS (Cloudflare) y nginx

1. **DNS** en Cloudflare (zona `navaxa.cl`, NS delegados en NIC Chile):
   - `A` `navaxa.cl` → IP del VPS, **Proxied** (nube naranja)
   - `A` `www` → IP del VPS, **Proxied**
   - `cdn.navaxa.cl` → bucket R2 (solo si usas storage real)
2. **Cert Origin**: Cloudflare → SSL/TLS → Origin Server → Create Certificate para
   `navaxa.cl` + `*.navaxa.cl`. Guarda los dos bloques en el VPS:
   - `/etc/ssl/cloudflare/navaxa.cl.pem` (cert, perms 644)
   - `/etc/ssl/cloudflare/navaxa.cl.key` (private key, `chmod 600`)
3. **SSL/TLS → Overview → modo `Full (strict)`** (no Flexible: causa loop de redirect).
4. **HSTS** (SSL/TLS → Edge Certificates → HSTS): Enable ON, Max Age 12 months,
   includeSubDomains ON, **Preload OFF** (es semi-irreversible), No-Sniff ON.
5. **vhost nginx** en `/etc/nginx/sites-available/navaxa` (proxy a `127.0.0.1:3004`,
   TLS con el cert Origin). La copia versionada está en [deploy/nginx/](deploy/nginx/):

```sh
cp deploy/nginx/navaxa.conf            /etc/nginx/sites-available/navaxa
cp deploy/nginx/cloudflare-realip.conf /etc/nginx/snippets/
cp deploy/nginx/cloudflare-geo.conf    /etc/nginx/conf.d/
ln -s /etc/nginx/sites-available/navaxa /etc/nginx/sites-enabled/navaxa
nginx -t && systemctl reload nginx
```

Verifica público: `curl -I https://navaxa.cl/` → `200`; `http://navaxa.cl` redirige a https.

### Origen cerrado a Cloudflare

El vhost responde **403 a todo lo que no venga de un edge de Cloudflare** (o de
loopback). Es lo que sostiene el rate-limit de login: `clientIp()`
([apps/web/lib/rate-limit.ts](apps/web/lib/rate-limit.ts)) confía en
`CF-Connecting-IP`, y ese header se puede inventar si la IP del VPS es alcanzable
directo. Dos piezas:

- `snippets/cloudflare-realip.conf` — `set_real_ip_from` con los rangos CF +
  `real_ip_header CF-Connecting-IP`. Solo define confianza, no filtra.
- `conf.d/cloudflare-geo.conf` — `geo $realip_remote_addr $cf_edge`, y el vhost
  hace `if ($cf_edge = 0) { return 403; }`.

**El geo va contra `$realip_remote_addr`, no `$remote_addr`.** Con
`real_ip_header` activo, `$remote_addr` ya es la IP del visitante final, así que
un `allow <rangos CF>; deny all;` normal (módulo access, que mira la IP
reescrita) bloquearía a todo el mundo. `$realip_remote_addr` guarda la IP del
peer real y cae a `$remote_addr` cuando no hubo reescritura, que es justo el hit
directo que queremos cortar.

Regenerar los rangos cuando CF los cambie (raro, pero pasa):

```sh
curl -s https://www.cloudflare.com/ips-v4 https://www.cloudflare.com/ips-v6
```

Verificar:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://navaxa.cl/                                    # 200
curl -sk --resolve navaxa.cl:443:<IP_DEL_VPS> -o /dev/null -w '%{http_code}\n' https://navaxa.cl/  # 403
```

Ojo: cualquier monitor de uptime que pegue directo a la IP del origen empieza a
ver 403; hay que apuntarlo al dominio.

## 5. Reemplazar los proveedores mock

Dos categorías:

**a) Solo configuración (el código ya existe, faltan llaves):**
- **Email (Resend):** `NOTIF_EMAIL_PROVIDER=resend`, `RESEND_API_KEY=...`. Verifica el dominio
  `navaxa.cl` en Resend para enviar desde `contacto@navaxa.cl` (registros SPF/DKIM en DNS).
- **Storage (Cloudflare R2):** `STORAGE_PROVIDER=r2`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL=https://cdn.navaxa.cl`.
  Apunta el DNS de `cdn.navaxa.cl` al bucket (custom domain de R2). La compresión + thumbnail
  (sharp) ya está lista y se activa al subir.
- **WhatsApp (Meta Cloud API):** `NOTIF_WHATSAPP_PROVIDER=meta` + `WHATSAPP_PHONE_NUMBER_ID` +
  `WHATSAPP_ACCESS_TOKEN`. Feature de plan PRO/ENTERPRISE. Las plantillas deben aprobarse como
  **Utility** en Meta (no Marketing) — textos y orden de variables en `docs/whatsapp-templates.md`.
- **IA:** `ANTHROPIC_API_KEY=...` (gateado a PRO/ENTERPRISE; default modelo Haiku).
- **Captcha (Cloudflare Turnstile):** `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, sacadas de
  Cloudflare → Turnstile → *Add site* (hostname `navaxa.cl`, widget *Managed*). Protege el POST
  de reserva pública (`/api/public/[slug]/book`). Con una sola de las dos llaves el captcha queda
  **apagado** (no-op: el widget no se renderiza y el servidor no verifica), así que hay que poner
  ambas. No son `NEXT_PUBLIC_*`: la site key la inyecta el Server Component como prop, así que
  basta `docker compose up -d web` — sin rebuild. Para verificar: abrir la reserva pública y ver
  el widget bajo el formulario; un POST a `/book` sin `captchaToken` debe responder 400.

Tras cambiar `.env`: `docker compose up -d` (recrea el contenedor). Si tocaste
`NEXT_PUBLIC_*`, además `docker compose build web`.

**b) Requiere CÓDIGO (solo existe el mock):**
- **Pagos** (abono al reservar, `apps/web/lib/payments.ts`) y **suscripción SaaS**
  (`apps/web/lib/billing.ts`). Hay una abstracción de proveedor; falta implementar la pasarela
  real (Flow / Webpay / Mercado Pago) y seleccionarla por `PAYMENT_PROVIDER`. Esto es desarrollo,
  no solo config.

## 6. Watch-points (lo más probable de ajustar al construir)

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
- **Puerto ocupado:** si `up` falla por bind, otro servicio del VPS tomó el 3004; cambia el puerto
  en `docker-compose.override.yml` y ajusta el `proxy_pass` del vhost nginx.

## 7. Comandos útiles

```sh
docker compose up -d --build web                     # actualizar tras git pull
docker compose logs -f web                           # logs
docker compose exec web prisma migrate deploy \
  --schema=./packages/db/prisma/schema.prisma        # migrar a mano
docker compose exec postgres psql -U navaxa navaxa   # consola SQL
docker compose exec postgres pg_dump -U navaxa navaxa > backup.sql   # backup
docker compose down                                  # bajar (los datos persisten en el volumen)
```

## 8. Actualizaciones

```sh
git pull
docker compose build web
docker compose up -d        # las migraciones nuevas corren al recrear web
```

Los datos de Postgres persisten en el volumen `navaxa_pg` (haz backups regulares). El dominio,
IG (`navaxa.app`) y email (`contacto@navaxa.cl`) ya están reconciliados en el código a `navaxa.cl`.
