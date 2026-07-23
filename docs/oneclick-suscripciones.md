# Renovación automática de la suscripción (Webpay Oneclick)

Antes, cada renovación del plan era manual: el job solo marcaba `PAST_DUE` y el
dueño tenía que volver a pagar one-shot por el link de facturación. Con Oneclick
la tarjeta queda inscrita en Transbank y el cron cobra sin nadie presente.

## Qué hace cada pieza

| Archivo | Rol |
| --- | --- |
| [lib/oneclick.ts](../apps/web/lib/oneclick.ts) | cliente REST (inscribir, confirmar, cobrar, estado, borrar) |
| [lib/subscription-billing.ts](../apps/web/lib/subscription-billing.ts) | el cobro en sí: idempotencia, reintentos, avisos |
| [api/billing/route.ts](../apps/web/app/api/billing/route.ts) | acciones `card_inscribe`, `card_remove`, `charge_now` |
| [api/billing/oneclick/return](../apps/web/app/api/billing/oneclick/return/route.ts) | vuelta desde Transbank: guarda el `tbk_user` |
| [notifications/jobs.ts](../apps/web/lib/notifications/jobs.ts) | `processSubscriptionRenewals`, una vez al día |

## El flujo

1. **Inscripción.** El dueño aprieta "Activar cobro automático" en
   Configuración → Plan. El server pide una inscripción a Transbank y guarda el
   token en `subscriptions.oneclickToken`; el browser hace **POST** (no GET) a
   `url_webpay` con el campo `TBK_TOKEN`.
2. **Vuelta.** Transbank llega a `/api/billing/oneclick/return` con `TBK_TOKEN` y
   nada más — ni sesión ni cookie útil, porque el POST es cross-site y una cookie
   `SameSite=Lax` no viaja. Por eso el token guardado en el paso 1 es lo que
   identifica al tenant. Se confirma la inscripción y queda el `tbk_user`.
   Confirmar **no cobra**.
3. **Cobro.** El cron diario toma las suscripciones vencidas (`ACTIVE` o
   `PAST_DUE` con `currentPeriodEnd < now`) y cobra el precio del plan. Sin
   `tbk_user` el comportamiento es el viejo: quedan `PAST_DUE`.

## Reglas de plata

- **Idempotencia por ciclo.** `subscription_charges` tiene UNIQUE
  `(subscriptionId, periodEnd, attempt)` y la fila se crea `PENDING` **antes** de
  llamar a Transbank. Dos corridas en paralelo → la segunda choca contra el
  índice y se va, en vez de cobrar dos veces.
- **Reconciliación.** Si el proceso muere entre el POST y el guardado, la fila
  queda `PENDING`. La corrida siguiente **pregunta el estado a Transbank** por
  `buy_order` antes de decidir. Si no se puede preguntar, no se reintenta.
- **buy_order nuevo por intento.** Transbank rechaza un `buy_order` repetido, así
  que cada intento lleva sufijo `aN`.
- **3 intentos** (`MAX_RENEWAL_ATTEMPTS`), uno por día (`RETRY_COOLDOWN_HOURS`).
  Al agotarse, la cuenta baja a Gratis y se avisa por email. La tarjeta se
  conserva: volver al plan es un click.
- **El período nuevo arranca el día del cobro**, no en el vencimiento viejo:
  durante la mora la cuenta siguió funcionando, no corresponde cobrar días ya
  usados. Excepción: renovación anticipada (período aún vigente) extiende desde
  el vencimiento, para no perder días.
- **navaxa nunca ve el número de tarjeta.** Transbank devuelve enmascarado; se
  guardan marca y últimos 4 para mostrarlos.

## Configuración

Oneclick es siempre "Mall": un código de comercio **padre** (autentica) y al
menos uno **hijo** (recibe el cobro). Se afilia aparte de Webpay Plus, en el
portal de Transbank.

```bash
ONECLICK_MALL_COMMERCE_CODE="..."   # padre
ONECLICK_CHILD_COMMERCE_CODE="..."  # hijo (tienda)
ONECLICK_API_KEY="..."
WEBPAY_ENV="production"             # compartida con Webpay Plus
```

Con las tres vacías se usan las credenciales públicas de integración. El guard
fail-closed las rechaza si `NODE_ENV=production` sin
`WEBPAY_ALLOW_INTEGRATION=1`: si no, un cobro simulado pasaría por exitoso y
regalaríamos el plan. Mismo criterio que [lib/webpay.ts](../apps/web/lib/webpay.ts).

Sin credenciales ni escotilla, la sección "Cobro automático" no se muestra
(`oneclickEnabled()`), y la renovación cae al comportamiento viejo.

## Probarlo sin mover plata

En el stack de prueba ([sandbox-pagos.md](sandbox-pagos.md)), que ya corre con
`WEBPAY_ENV=integration` y `WEBPAY_ALLOW_INTEGRATION=1`. Tarjetas del sandbox de
Transbank:

| Tarjeta | Número | Resultado |
| --- | --- | --- |
| Visa | 4051 8856 0044 6623 · CVV 123 · cualquier fecha futura | aprueba |
| Mastercard | 5186 0595 5959 0568 · CVV 123 | rechaza |

En el formulario de Transbank el RUT es `11.111.111-1` y la clave `123`.

Para forzar una renovación sin esperar al cron:

```sql
UPDATE subscriptions SET "currentPeriodEnd" = now() - interval '1 day' WHERE "tenantId" = '...';
```

```bash
curl -X POST "https://<host>/api/webhooks/notifications?job=renew_subscriptions" -H "Authorization: Bearer $CRON_SECRET"
```

(El header exacto sale de [api/webhooks/notifications](../apps/web/app/api/webhooks/notifications/route.ts).)

## Lo que no está

- **Anulación/reversa** existe en el cliente (`refundOneclickCharge`) pero no hay
  UI: hoy un cobro mal hecho se devuelve desde el portal de Transbank.
- **Cambio de plan a mitad de período** no prorratea: cobra el precio completo
  del plan nuevo y reinicia el período.
