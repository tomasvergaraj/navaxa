# Entorno de prueba de pagos (sandbox de Transbank)

Producción cobra de verdad: `WEBPAY_ENV=production` con el código de comercio
real. Para probar un cobro end-to-end sin mover dinero existe un stack aparte,
`docker-compose.sandbox.yml`, que corre **la misma imagen** contra
`webpay3gint.transbank.cl` y una base de datos propia.

## Levantarlo

```bash
docker compose -p navaxa-sandbox -f docker-compose.sandbox.yml up -d --build
```

Necesita un `.env.sandbox` (gitignoreado; ver la cabecera del compose para el
contenido mínimo). Lo importante:

| Variable | Valor | Por qué |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | `webpay` | `mock` sirve para probar la lógica sin pasarela |
| `WEBPAY_ENV` | `integration` | apunta a `webpay3gint` |
| `WEBPAY_ALLOW_INTEGRATION` | `1` | **jamás en el `.env` de producción** |
| `WEBPAY_COMMERCE_CODE` / `WEBPAY_API_KEY` | sin setear | usa las credenciales públicas de Transbank |
| `STORAGE_PROVIDER`, `NOTIF_*` | `mock` | no toca R2 ni manda correos reales |

`WEBPAY_ALLOW_INTEGRATION` existe porque la imagen de Next **siempre** corre con
`NODE_ENV=production`, y el guard fail-closed de [lib/webpay.ts](../apps/web/lib/webpay.ts)
rechaza el modo integración en producción. La escotilla se ignora sola si
`WEBPAY_ENV=production`, así que la combinación "credenciales reales + modo
prueba" no puede existir.

## Cómo se navega

En **https://sandbox.navaxa.cl**, detrás de basic auth. El contenedor solo
escucha en `127.0.0.1:3005`; quien lo publica es nginx.

Montaje (una vez):

1. **DNS**: registro `sandbox.navaxa.cl` → este VPS en Cloudflare, **proxied**.
   Si no está proxied, el guard `$cf_edge` del vhost responde 403 a todo.
2. **nginx**:
   ```bash
   cp deploy/nginx/navaxa-sandbox            /etc/nginx/sites-available/navaxa-sandbox
   cp deploy/nginx/navaxa-sandbox-proxy.conf /etc/nginx/snippets/
   ln -s /etc/nginx/sites-available/navaxa-sandbox /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```
   El cert Origin de Cloudflare de `navaxa.cl` es wildcard, cubre el subdominio.
3. **Basic auth**: el `.htpasswd` vive en `/etc/nginx/.htpasswd-navaxa-sandbox`.
   Regenerar la clave:
   ```bash
   printf 'navaxa:%s\n' "$(openssl passwd -apr1 'CLAVE_NUEVA')" \
     > /etc/nginx/.htpasswd-navaxa-sandbox
   ```
4. **Link en /admin**: setear `SANDBOX_URL=https://sandbox.navaxa.cl` en el `.env`
   de producción y `docker compose up -d web`. Sin esa variable el panel queda
   igual que antes (la tarjeta no se renderiza).

El vhost sirve `robots.txt` con `Disallow: /` y `X-Robots-Tag: noindex`: es una
copia de la app con datos falsos, no debe indexarse. El return de Webpay
(`/api/public/webpay/`) va **sin** basic auth, porque llega como POST cross-site
desde Transbank; ese endpoint igual exige un `token_ws` que solo existe si la
transacción se creó acá.

Alternativa sin DNS: túnel SSH (`ssh -L 3005:127.0.0.1:3005 <vps>`), volviendo
`AUTH_URL`/`NEXT_PUBLIC_APP_URL` a `http://localhost:3005`. Ojo con eso: Auth.js
nombra su cookie de sesión según el protocolo de `AUTH_URL`, y el middleware la
buscaba según `NODE_ENV` (siempre `production` en la imagen), así que en http
toda sesión se veía anónima. Ya está alineado con Auth.js en
[middleware.ts](../apps/web/middleware.ts); en producción `AUTH_URL` es https y
el valor no cambió.

## Tarjetas de prueba de Transbank

| Tarjeta | Número | Resultado |
| --- | --- | --- |
| Visa | 4051 8856 0044 6623 | aprueba (CVV 123, cualquier fecha futura) |
| Mastercard | 5186 0595 5959 0568 | rechaza |

Autenticación: RUT `11.111.111-1`, clave `123`.

El formulario de Transbank está detrás de Incapsula: **no se automatiza por
curl**, hay que hacer el click en un navegador.

## Qué probar

1. Vitrina → «Regala una giftcard» → monto y datos → «Continuar al pago».
2. En el checkout, «Pagar con Webpay» → tarjeta de prueba → vuelve a
   `/regalar/orden/[token]` con el código emitido.
3. Con la tarjeta que rechaza: la orden queda `FAILED` y **no** se emite ninguna
   giftcard.
4. Botón «Anular compra» de Webpay: la orden queda `FAILED` y vuelve a
   `/regalar/[slug]?cancelado=1`.

## Qué queda cubierto sin navegador

Con `PAYMENT_PROVIDER=mock` en el sandbox se prueba toda la lógica de negocio
(emisión, venta que reconoce el ingreso, idempotencia ante doble confirmación,
canje posterior en caja). Lo único que exige el navegador es el tramo contra
Transbank.

## Limpieza

```bash
docker compose -p navaxa-sandbox -f docker-compose.sandbox.yml down -v
```

`-v` borra también su volumen de Postgres. Nada de esto toca la base de
producción: son contenedores, red y volumen distintos.
