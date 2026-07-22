# Fase 2 — Cobrar el saldo de una cita con link/QR de Webpay

Continúa [el cobro manual](../CLAUDE.md) ya en prod (commit `186dd21`): hoy el dueño
registra el saldo cobrado en el local (efectivo, POS, transferencia). Falta que el
**cliente pague desde su propio teléfono**: el dueño genera un link (o muestra un QR),
el cliente paga con Webpay y la `Sale` del saldo se crea sola al confirmarse el cobro.

## Por qué un modelo nuevo

`Payment.appointmentId` es `@unique` ([schema.prisma:425](../packages/db/prisma/schema.prisma#L425)):
una cita admite a lo sumo un abono, y ese lugar ya está ocupado. El precedente exacto es
`GiftCardOrder`, que existe por el mismo motivo (pago público sin `Payment` donde colgar).

## 1. Schema — `AppointmentCharge`

```prisma
/// Cobro online del saldo de una cita: el cliente paga por link/QR desde su
/// teléfono. No cabe en `Payment` (appointmentId @unique) y una cita puede
/// tener varios cobros. Al confirmarse crea la `Sale` kind=APPOINTMENT_BALANCE.
model AppointmentCharge {
  id            String        @id @default(cuid())
  tenantId      String
  appointmentId String
  amount        Int           // CLP entero
  currency      String        @default("CLP")
  status        PaymentStatus @default(PENDING)
  provider      String        @default("mock")
  providerRef   String?       // token_ws de Webpay
  expiresAt     DateTime      // vence el link, no la deuda
  paidAt        DateTime?
  saleId        String?       @unique // la Sale creada al confirmar
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  sale        Sale?       @relation(fields: [saleId], references: [id], onDelete: SetNull)

  @@index([tenantId, status])
  @@index([appointmentId, status])
  @@index([providerRef])
  @@index([status, expiresAt])
  @@map("appointment_charges")
}
```

Relaciones inversas: `Tenant.appointmentCharges`, `Appointment.charges`,
`Sale.appointmentCharge`. Migración `20260723HHMMSS_appointment_charge_links`.

TTL del link: **24 h** (`APPOINTMENT_CHARGE_TTL_MIN = 1440`). Más largo que los 20 min del
abono porque acá no hay hora que liberar: lo único que caduca es el enlace.

## 2. `lib/appointment-charge-links.ts` (nuevo)

Importa `signed-token` → **arrastra `node:crypto`**, así que este módulo NO puede quedar
alcanzable desde `instrumentation.ts` (trampa de bundle Edge documentada en
[payment-release.ts:4-9](../apps/web/lib/payment-release.ts#L4-L9)). Por eso el job de
expiración va aparte (§6).

- `signAppointmentChargeToken(id)` / `verifyAppointmentChargeToken(token)` — scope nuevo
  `apptcharge`, `TOKEN_TTL.apptCharge = 7 días` (el guard real es `expiresAt`).
- `createAppointmentChargeLink({ tenantId, appointmentId, amount })`:
  - Recalcula el saldo con `computeAppointmentBalance` (nunca confiar en el monto del
    cliente) y rechaza `amount > balance`, `balance <= 0` y estado no cobrable.
  - **Reusa** el link PENDING no vencido si ya existe con el mismo monto, en vez de
    emitir dos: si no, el dueño manda dos QR y el cliente puede pagar dos veces.
  - Devuelve `{ charge, token, url }`.
- `loadAppointmentChargeByToken(token)` — include tenant + appointment (servicios, barbero).
- `refreshWebpayTransaction(charge)`: crea la transacción en Transbank **de forma
  perezosa**, al abrir la página pública, si `providerRef` es null o `updatedAt` tiene más
  de 5 min. Motivo: el token de Webpay es efímero y el link vive 24 h — crearlo al generar
  el QR (como hace `createGiftCardOrder`) lo dejaría muerto para cuando el cliente lo abra.
  `buy_order: ac_<id>` (tope 26 chars), `return_url: /api/public/webpay/appointment-return`.
- `confirmAppointmentCharge(chargeId, { authorizationCode })`: en UNA `$transaction`,
  claim optimista `updateMany({ status: PENDING } → PAID)` (idempotente ante dos returns
  concurrentes de Webpay, igual que `confirmGiftCardOrder`), y crea la `Sale`:
  `kind: "APPOINTMENT_BALANCE"`, `paymentMethod: "CARD"`, `appointmentId`, `clientId`,
  `barberId`, item libre `Saldo: <servicios>`, nota `Pago online Webpay (op. NNNN)`.
- `failAppointmentCharge(id, status)` — `FAILED` / `EXPIRED`. No hay nada que liberar.

### Sobrepago: se registra, no se rechaza

Si entre la emisión del link y el pago el dueño cobró el saldo en efectivo, al confirmar
el saldo puede ser 0. **La `Sale` se crea igual**: Transbank ya movió la plata del cliente y
el sistema no puede negarla — negarla dejaría el dinero fuera del registro. Se anota en la
nota (`sobrepago`), se emite `console.warn` y el saldo simplemente queda en 0
(`Math.max(0, …)` de `computeAppointmentBalance`). La devolución es manual, fuera del
sistema.

Mitigación del caso: `chargeAppointmentBalance` ([appointment-charges.ts](../apps/web/lib/appointment-charges.ts))
pasa a **anular los links PENDING de la cita cuando el cobro manual deja el saldo en 0**,
dentro de su misma transacción. Así el QR ya circulando muestra «cita saldada» en vez de
cobrar.

## 3. API del dashboard

`POST /api/appointments/[id]/charge-link` — `requireRole(["OWNER","ADMIN","STAFF"])`, sin
gate de plan (mismo criterio que el cobro manual). Body `{ amount }`
(`appointmentChargeLinkSchema` en [validators.ts](../apps/web/lib/validators.ts)).
Devuelve `{ url, amount, expiresAt, qr }` donde `qr` es un **data URL PNG generado en el
server** con la dependencia nueva `qrcode` (+ `@types/qrcode`) — server-side para no
cargar la librería en el bundle del cliente.

`DELETE /api/appointments/[id]/charge-link` — anula el link vigente (status `EXPIRED`) para
cuando el dueño se arrepiente o el cliente termina pagando en efectivo.

El `GET /api/appointments/[id]/charge` existente suma `pendingLink: { url, amount, expiresAt } | null`.

## 4. Página pública `/pagar/cita/[token]`

Calcada de [/regalar/orden/[token]](../apps/web/app/regalar/orden/[token]/page.tsx), mismo
`Shell`, `robots: { index: false }`. Cuatro estados:

- **PENDING** → barbería, servicio + fecha de la cita, monto, y el checkout: form POST
  nativo a `webpayFormUrl()` con `token_ws` (o botón mock si `PAYMENT_PROVIDER=mock`).
  Componente cliente `appointment-charge-checkout.tsx`, gemelo de `GiftOrderCheckout`.
- **PAID** → «Pago recibido» + monto + link a `/reservar/gestion/<manageToken>`.
- **FAILED** → «El pago no se completó, no se te cobró nada».
- **EXPIRED / vencido / cita ya saldada** → «Este enlace ya no está vigente».

Ruta mock para el provider simulado: `POST /api/public/appointment-charge/[token]`
(espejo de [/api/public/giftcards/orden/[token]](../apps/web/app/api/public/giftcards/orden/[token]/route.ts)).

CSP: `form-action` ya lista los dos hosts de Transbank en
[next.config.mjs:49](../apps/web/next.config.mjs#L49) y es global — la página nueva queda
cubierta sin tocar nada. **Igual se prueba en navegador**, no por curl.

## 5. Return de Webpay — `/api/public/webpay/appointment-return`

Copia de [giftcard-return](../apps/web/app/api/public/webpay/giftcard-return/route.ts):
`POST` y `GET`, los cuatro casos (OK / rechazo / abort / timeout), lookup por
`providerRef`, reconciliación estricta `result.amount !== charge.amount` → `FAILED`, y
redirect 303 a `/pagar/cita/<token>` en todos los desenlaces.

## 6. Expiración de links

`expirePendingAppointmentCharges()` en [lib/notifications/jobs.ts](../apps/web/lib/notifications/jobs.ts),
al lado de `expirePendingPayments`, llamada en el mismo `setInterval` de
`instrumentation.ts`. Es un `updateMany` plano sobre `appointment_charges`
(`PENDING` + `expiresAt < now` → `EXPIRED`): **no importa** `appointment-charge-links.ts`,
justamente para no meter `node:crypto` en el bundle Edge.

## 7. UI en la agenda

En [appointment-detail-dialog.tsx](../apps/web/components/agenda/appointment-detail-dialog.tsx),
junto al botón «Cobrar saldo» que ya existe, un segundo botón **«Cobrar por link/QR»** que
abre `components/agenda/charge-link-dialog.tsx`:

- Monto prellenado con el saldo, editable hacia abajo (cobros parciales, igual que el manual).
- Al generar: QR grande, la URL con botón **Copiar**, y **Enviar por WhatsApp** vía
  `wa.me/<telefono>?text=…` — deep link del cliente, **sin costo de API** (no pasa por la
  Cloud API de Meta, ver [COSTS.md](../COSTS.md)).
- Aviso de vencimiento y botón **Anular link**.
- Si ya hay un link vigente, el diálogo lo muestra en vez de emitir otro.

En el bloque «Pago» del detalle, si hay link PENDING: línea «Link de cobro pendiente por
$X» para que el dueño no cobre dos veces por descuido.

## Regla contable — sin cambios

El cobro por link crea la MISMA `Sale kind=APPOINTMENT_BALANCE` que el cobro manual: no es
ingreso nuevo (ya se reconoció con el `totalPrice` de la cita `COMPLETED`), «Ventas caja»
sigue filtrando `COUNTER`, y aparece en la línea «Cobros de citas». Nada que tocar en
reportes ni en caja.

## Fuera de alcance

- Notificación automática del link por email/WhatsApp template (el share manual por
  `wa.me` cubre el caso sin costo).
- Fase 3 — deep link de SumUp. Descartado: el SDK de Tap to Pay es solo nativo y CLP no
  figura en el legacy `sumupmerchant://pay/1.0`. **No volver a investigarlo.**

## Verificación

1. `pnpm --filter web exec tsc --noEmit` limpio (en este VPS no hay corepack).
2. `pnpm --filter web build` — es lo único que atrapa `node:crypto` en el bundle Edge.
3. Migración aplicada por el entrypoint; confirmar con
   `docker exec navaxa-postgres psql -U navaxa -d navaxa -c "\d appointment_charges"`.
4. Sandbox (`PAYMENT_PROVIDER=webpay` + `WEBPAY_ALLOW_INTEGRATION=1`, puerto 3005): flujo
   completo con tarjeta de prueba de Transbank. El tramo del formulario de Transbank está
   detrás de Incapsula → **a mano en el navegador**, no por curl.
5. Prod por API: generar link (login real), verificar 403 con BARBER
   (`diego@nexosoftware.cl`), verificar rechazo de `amount > balance` tocando el body,
   verificar que un segundo POST reusa el link en vez de crear otro.
6. Contable: «Ingresos servicios» y «Ventas caja» no se mueven; «Cobros de citas» sube.
7. Todo dato de prueba creado en prod se borra después. Respetar los datos reales del
   dueño (las 3 ventas del 2026-07-17 y la giftcard con 2 canjes del 2026-07-22).
8. Commit sin trailer `Co-Authored-By`. Comillas en JSX con `« »`.
