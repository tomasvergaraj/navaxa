# WhatsApp en producción — guía paso a paso

Pasos para activar el envío real por WhatsApp (Meta Cloud API). Todo es en el
navegador + un comando final en el VPS. Los textos de las plantillas están en
[whatsapp-templates.md](whatsapp-templates.md).

> Estado del código: ya está listo. Esta guía es solo la configuración en Meta y
> las 3 variables de entorno. El cron del VPS ya quedó instalado.

## Requisitos previos

- Cuenta de Facebook personal (es el login de Meta Business; no se usa para nada
  público).
- Un número de teléfono que **no** tenga la app de WhatsApp (normal ni Business)
  instalada — Meta lo "toma" para la API. Puedes empezar con el número de prueba
  que da Meta y dejar el real para después.

## A. Meta Business Portfolio

1. Entra a https://business.facebook.com con tu Facebook.
2. Si no tienes uno: **Crear portfolio** → nombre "Nexosoftware", email
   `contacto@nexosoftware.cl`.

## B. App de desarrollador + producto WhatsApp

3. Ve a https://developers.facebook.com → arriba **My Apps** → **Create App**.
4. En **Casos de uso**, en el filtro de la izquierda elige **"Mensajes
   comerciales"** → marca el caso de uso de **WhatsApp** → **Siguiente**.
   (Si no aparece WhatsApp ahí, marca **"Crear una app sin un caso de uso"** y
   agregas el producto WhatsApp manualmente en el paso 6.)
5. Nombre de la app (ej. "navaxa-wa"), email, y **asóciala al Business Portfolio**
   del paso 2 → **Create**.
6. En el dashboard de la app, si no quedó ya, busca **WhatsApp** → **Set up**.
   Esto crea una **WABA** (WhatsApp Business Account) de prueba automáticamente.

## C. Número

7. Menú izquierdo: **WhatsApp → API Setup**.
8. Verás un **número de prueba** ya provisto por Meta. Para smoke sirve, pero solo
   manda a números que agregues en **"To" → Manage phone number list** (allowlist,
   hasta 5).
9. Para producción: **Add phone number** → ingresa tu número real → verifícalo por
   SMS/llamada.
10. **Copia el `Phone Number ID`** (en esa misma pantalla, debajo del número — es
    un número largo, **no** es el teléfono). → será `WHATSAPP_PHONE_NUMBER_ID`.

## D. Token permanente (System User)

El token que aparece en "API Setup" dura **24h**. Para prod necesitas uno sin
vencimiento:

11. **Business Settings** (https://business.facebook.com/settings) → **Users →
    System Users**.
12. **Add** → nombre "navaxa-cron", rol **Admin** → crear.
13. Selecciónalo → **Add Assets** → pestaña **Apps** → marca tu app → activa
    **Full control** → guardar.
14. Otra vez **Add Assets** → pestaña **WhatsApp Accounts** → marca tu WABA →
    **Full control** → guardar.
15. **Generate New Token** → elige tu app → **Token expiration: Never** → marca
    los permisos:
    - `whatsapp_business_messaging`
    - `whatsapp_business_management`
16. **Generate** → **cópialo ahora** (no se vuelve a mostrar). → será
    `WHATSAPP_ACCESS_TOKEN`.

## E. Aprobar las 9 plantillas (Utility)

17. **WhatsApp Manager** (https://business.facebook.com/wa/manage/message-templates)
    → **Create template**.
18. Por cada una de las 9 en [whatsapp-templates.md](whatsapp-templates.md):
    - **Category: Utility** (NO Marketing — más barato y aprueba más fácil).
    - **Name**: exacto (`reminder_24h`, `reminder_1h`, …).
    - **Language: Spanish** (`es`).
    - **Body**: pega el texto con `{{1}}…{{n}}` tal cual del doc.
    - Meta pide un **ejemplo por variable** (ej. "Juan", "12 jun", "15:30") → solo
      para revisión.
    - **Submit**. Estado: *In review* → *Approved* (de minutos a ~24h).
19. Repite hasta tener las 9 en *Approved*. (`barber_invite` y `password_reset` NO
    van acá: son email.)

## F. Variables de entorno + recrear el contenedor

20. Edita `/var/www/navaxa/.env`:
    ```
    NOTIF_WHATSAPP_PROVIDER=meta
    WHATSAPP_PHONE_NUMBER_ID=<el del paso 10>
    WHATSAPP_ACCESS_TOKEN=<el del paso 16>
    ```
21. Recrea el contenedor:
    ```
    docker compose up -d --force-recreate web
    ```

## G. Smoke test

A un número en allowlist si usas el de prueba:
```
curl -s "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"569XXXXXXXX","type":"template",
       "template":{"name":"thanks_post_visit","language":{"code":"es"},
       "components":[{"type":"body","parameters":[{"type":"text","text":"Juan"}]}]}}'
```
Respuesta OK: `{"messages":[{"id":"wamid..."}]}` y te llega el WhatsApp.

## H. Verificación final en la app

- Tenant en plan **PRO/ENTERPRISE** + cliente con teléfono cargado.
- Una **Campaign activa** con `channel = WHATSAPP` y el trigger/templateKey
  correctos.
- Tras un envío, en BD:
  ```sql
  SELECT status,"providerId","errorMessage"
  FROM notification_logs ORDER BY "createdAt" DESC LIMIT 5;
  ```
  → debe quedar `SENT` con `providerId` = wamid.

## Gotchas

- Al inicio estás en **modo prueba**: solo mandas a números de la allowlist y con
  límite bajo. Para mandar a cualquiera necesitas **verificar el negocio**
  (Business Verification) en Business Settings → Security Center.
- El idioma del template debe calzar con `WHATSAPP_TEMPLATE_LANG` (default `es`).
  Si registras en "Spanish (Chile) `es_CL`", setea esa env.
- Si el smoke da error de template: revisa nombre exacto, idioma, y que esté
  *Approved*.
- El número de la WABA NO puede tener la app de WhatsApp consumer instalada.
