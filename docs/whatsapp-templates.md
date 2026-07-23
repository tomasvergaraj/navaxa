# Templates de WhatsApp (Meta Cloud API)

Navaxa manda los mensajes business-initiated por **template aprobado** (Meta no
admite texto libre fuera de la ventana de 24h). Esta es la lista a registrar en
**Meta Business → WhatsApp Manager → Plantillas de mensajes**.

## Reglas

- **Categoría: Utility** para todos (más barato y aprobación más simple — ver
  COSTS.md). NO usar Marketing.
- **Idioma**: Spanish (`es`). Si registras en otro código, setea
  `WHATSAPP_TEMPLATE_LANG` acorde.
- El **nombre** del template debe ser exactamente el de la columna *name*
  (= la `TemplateKey`). El mapeo y el orden de variables viven en
  [whatsapp.ts](../apps/web/lib/notifications/providers/whatsapp.ts) (`WA_TEMPLATES`).
- El **cuerpo** debe usar `{{1}}…{{n}}` en el MISMO orden que la columna
  *variables*. Si cambias el orden en Meta, cambia también `WA_TEMPLATES`.
- **Regla Meta**: una variable NO puede ir al inicio ni al final del cuerpo (ni
  con un punto pegado al final). Por eso varios templates llevan texto fijo de
  cierre ("¡Te esperamos!", "¡Gracias!", etc.) después de la última variable.

> **Estado (2026-05-29):** las 9 plantillas ya fueron creadas vía API en la WABA
> de prueba (`1366348118649658`) y están en revisión (`PENDING`). 7 son UTILITY,
> 2 MARKETING (`recall_30d`, `birthday` — son promocionales, Meta no las acepta
> como Utility). Al pasar a producción con el número real **en la misma WABA**,
> estas plantillas se reutilizan; si creas otra WABA, hay que recrearlas.
>
> **Update 2026-07-14:** quedan **8 plantillas** vigentes: `haircut_rating_request`
> se eliminó del código (invitación única post-visita). No crearla en Twilio.
>
> **Update 2026-07-15:** se agregó `appointment_scheduled` → son **9 plantillas**
> vigentes. Al crear/reagendar una cita el cliente recibe "hora agendada";
> "hora confirmada" (`appointment_confirmed`) se envía SOLO cuando el local
> confirma la cita desde el panel.

## Variables de entorno

```
NOTIF_WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=<phone number id del número de la WABA>
WHATSAPP_ACCESS_TOKEN=<system user token permanente>
WHATSAPP_API_VERSION=v21.0          # opcional
WHATSAPP_TEMPLATE_LANG=es           # opcional
```

Con `NOTIF_WHATSAPP_PROVIDER` vacío o ≠ `meta` queda en **mock** (solo loguea).

## Plantillas

### reminder_24h — variables: 1=firstName, 2=date, 3=time, 4=barberName
```
Hola {{1}} 👋 Te recordamos tu hora mañana {{2}} a las {{3}} con {{4}}. ¿Confirmas? Responde SÍ o NO.
```

### reminder_1h — variables: 1=firstName, 2=shopName, 3=address
```
Hola {{1}}, te esperamos en una hora en {{2}}. Dirección: {{3}}. ¡Nos vemos pronto!
```

### thanks_post_visit — variables: 1=firstName
```
Gracias por tu visita, {{1}}. ¿Qué tal quedó el corte? Tu opinión nos ayuda a mejorar 🙏
```

### recall_30d — variables: 1=firstName, 2=barberName, 3=bookingUrl — categoría MARKETING
```
Hola {{1}}, hace un mes que no nos vemos. {{2}} tiene horas disponibles esta semana. Reserva acá: {{3}} ¡Te esperamos!
```

### birthday — variables: 1=firstName, 2=shopName — categoría MARKETING
```
¡Feliz cumpleaños, {{1}}! 🎉 Tienes 20% off en tu próximo corte. Te esperamos en {{2}} para celebrarlo.
```

### appointment_scheduled — variables: 1=date, 2=time, 3=barberName, 4=shopName
```
Tu hora quedó agendada: {{1}} {{2}} con {{3}} en {{4}}. ¡Nos vemos!
```

### appointment_confirmed — variables: 1=date, 2=time, 3=barberName, 4=shopName
```
Tu hora quedó confirmada: {{1}} {{2}} con {{3}} en {{4}}. ¡Nos vemos!
```

### appointment_cancelled — variables: 1=date, 2=time
```
Tu hora del {{1}} a las {{2}} fue cancelada. Si quieres reagendar, responde este mensaje.
```

### review_request — variables: 1=firstName, 2=shopName, 3=reviewUrl
```
Hola {{1}} 👋 Gracias por tu visita a {{2}}. ¿Nos dejas tu reseña? Toma menos de un minuto: {{3}} ¡Gracias!
```

> Nota (2026-07-14): `haircut_rating_request` se eliminó — la invitación única
> post-visita (`review_request`) cubre también la calificación del corte.

## Puesta en marcha (runbook)

Pasos exactos para pasar de mock → producción. El código ya está; esto es todo
configuración en Meta + env.

### 1. Meta Business + App
1. Entra a https://business.facebook.com con la cuenta de Nexosoftware. Si no
   hay Business Portfolio, créalo.
2. En https://developers.facebook.com → **My Apps → Create App** → tipo
   **Business** → asóciala al Business Portfolio.
3. En la app, **Add Product → WhatsApp → Set up**. Esto crea/asocia una WABA
   (WhatsApp Business Account).

### 2. Número
- Para probar ya: usa el **número de prueba** que da Meta (manda solo a números
  agregados a la allowlist; sirve para smoke).
- Para producción: **Add phone number** a la WABA → verifícalo por SMS/llamada.
  Debe ser un número que NO tenga la app de WhatsApp normal instalada.
- Anota el **Phone Number ID** (no el número en sí) → va en
  `WHATSAPP_PHONE_NUMBER_ID`. Está en *WhatsApp → API Setup*.

### 3. Token permanente (System User)
El token temporal de la pantalla de setup dura 24h. Para prod usa un System User:
1. **Business Settings → Users → System Users → Add** → rol *Admin*.
2. **Add Assets** → asigna la **App** y la **WhatsApp Account (WABA)** con
   control total.
3. **Generate New Token** → elige la app → scopes:
   `whatsapp_business_messaging` + `whatsapp_business_management` → **sin
   expiración**. Cópialo → va en `WHATSAPP_ACCESS_TOKEN` (no se vuelve a mostrar).

### 4. Registrar las plantillas (9 vigentes)
En **WhatsApp Manager → Plantillas de mensajes → Crear plantilla**, una por cada
sección de arriba:
- Categoría **Utility**, idioma **Spanish (es)**.
- Nombre EXACTO de la columna *name*.
- Pega el cuerpo con `{{1}}…{{n}}` tal cual.
- Meta pide un **ejemplo** por variable (cualquier valor de muestra, ej. "Juan",
  "12 jun", "15:30").
- Aprobación: de minutos a ~24h. Estado *Approved* = lista para usar.

### 5. Env en el VPS
En el `.env` de prod:
```
NOTIF_WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=<el de paso 2>
WHATSAPP_ACCESS_TOKEN=<el de paso 3>
```
Recrear el contenedor:
```
docker compose up -d --force-recreate web
```

### 6. Smoke test (antes de confiar en el flujo real)
Curl directo a Meta con tus credenciales (a un número en allowlist si usas el de
prueba):
```
curl -s "https://graph.facebook.com/v21.0/$WHATSAPP_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"569XXXXXXXX","type":"template",
       "template":{"name":"thanks_post_visit","language":{"code":"es"},
       "components":[{"type":"body","parameters":[{"type":"text","text":"Juan"}]}]}}'
```
Respuesta OK trae `{"messages":[{"id":"wamid..."}]}`. Si da error de template,
revisa nombre/idioma/estado *Approved*.

### 7. Activar el flujo en la app
El provider solo se usa cuando el flujo enruta a WhatsApp:
- El tenant debe ser plan **PRO o ENTERPRISE** (si no, degrada a email — ver
  `lib/notifications/channel.ts`).
- El cliente debe tener **teléfono** cargado.
- Los recordatorios/recall necesitan una **Campaign activa** con el `trigger` y
  `templateKey` correctos y `channel = WHATSAPP` (ver `lib/notifications/jobs.ts`).
- Los jobs (`processReminders24h/1h`, `processInactiveRecalls`) corren por el
  endpoint de cron — ver paso 8 (en este VPS NO hay Vercel, hay que poner cron
  en el host).

### 8. Cron en el host (OBLIGATORIO en este VPS)
`vercel.json` define los crons pero **solo aplica en Vercel**. Acá corre en
Docker → hay que disparar el endpoint desde el host. Sin esto, recordatorios y
recall NUNCA se envían. El web container escucha en `127.0.0.1:3004`.

Crea `/etc/cron.d/navaxa-notifications` (reemplaza `SECRETO` por el valor de
`CRON_SECRET` del `.env`):
```cron
# m h dom mon dow user command
*/15 * * * * root curl -s -X POST -H "Authorization: Bearer SECRETO" "http://127.0.0.1:3004/api/webhooks/notifications?job=reminders"      > /dev/null
*/15 * * * * root curl -s -X POST -H "Authorization: Bearer SECRETO" "http://127.0.0.1:3004/api/webhooks/notifications?job=reminders1h"    > /dev/null
*/15 * * * * root curl -s -X POST -H "Authorization: Bearer SECRETO" "http://127.0.0.1:3004/api/webhooks/notifications?job=expire_payments" > /dev/null
0    * * * * root curl -s -X POST -H "Authorization: Bearer SECRETO" "http://127.0.0.1:3004/api/webhooks/notifications?job=renew_subscriptions" > /dev/null
0   10 * * * root curl -s -X POST -H "Authorization: Bearer SECRETO" "http://127.0.0.1:3004/api/webhooks/notifications?job=recalls"        > /dev/null
```
Recarga: `systemctl restart cron` (o `service cron reload`). Prueba una a mano:
```
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:3004/api/webhooks/notifications?job=reminders"
```
Debe responder JSON `{"job":"reminders","processed":N,...}` (no 403/503).

Verificación final: tras disparar un envío, en BD
`SELECT status, "providerId", "errorMessage" FROM notification_logs ORDER BY "createdAt" DESC LIMIT 5;`
→ debe quedar `SENT` con `providerId` = wamid.

## Notas

- `barber_invite` y `password_reset` van por **email** (flujos de staff), no por
  WhatsApp. No hace falta registrarlos como template WA.
- Los templates con link (`recall_30d`, `review_request`)
  llevan la URL como variable de cuerpo. Si Meta exige botón URL dinámico, se
  puede mover a un componente `button` — por ahora va en el cuerpo (aprobación
  más simple).

## Alternativa: Twilio (provider `twilio`)

El código soporta dos backends de WhatsApp: Meta Cloud API (`NOTIF_WHATSAPP_PROVIDER=meta`)
y **Twilio** (`=twilio`). El provider Twilio ya está escrito
([whatsapp.ts](../apps/web/lib/notifications/providers/whatsapp.ts),
`TwilioWhatsappProvider`); solo falta setear env cuando aprueben el sender.

1. En **Twilio → Content Template Builder** crea los mismos templates (Utility),
   con `{{1}}…{{n}}` en el orden de la columna *variables* de este doc (el mismo
   orden de `WA_TEMPLATES`, así son intercambiables con Meta). Cada uno da un
   **ContentSid** (`HX…`).
2. Env en el `.env` de prod:
   ```
   NOTIF_WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=AC…
   TWILIO_AUTH_TOKEN=…
   TWILIO_WHATSAPP_FROM=whatsapp:+56957549549
   TWILIO_CONTENT_SIDS={"reminder_24h":"HX…","reminder_1h":"HX…","thanks_post_visit":"HX…","recall_30d":"HX…","birthday":"HX…","appointment_scheduled":"HX…","appointment_confirmed":"HX…","appointment_cancelled":"HX…","review_request":"HX…"}
   TWILIO_STATUS_CALLBACK_URL=https://navaxa.cl/api/webhooks/twilio
   ```
   `TWILIO_CONTENT_SIDS` es un JSON `TemplateKey → ContentSid` (una sola línea).
3. Estados de entrega: configura `TWILIO_STATUS_CALLBACK_URL` (se manda como
   `StatusCallback` en cada envío). El webhook
   [/api/webhooks/twilio](../apps/web/app/api/webhooks/twilio/route.ts) valida
   `X-Twilio-Signature` contra esa misma URL y actualiza `NotificationLog`
   (`delivered`/`read` → DELIVERED, `failed`/`undelivered` → FAILED). Sin la URL
   seteada el webhook responde 403 (no puede validar la firma tras el proxy).
