# Plan de features — cierre de brecha vs AgendaPro (2026-07-17)

Origen: comparación de la tabla de planes de AgendaPro contra el inventario real de navaxa.
Se implementan 8 features en 4 fases, ordenadas por valor/esfuerzo. Quedan **descartadas** por no aplicar a barberías: ficha clínica, consentimiento informado, videoconferencia y API pública para terceros.

Convenciones transversales (aplican a todo el plan):

- Multi-tenancy vía `scopedDb()` en toda query nueva (excepto modelo `Tenant`, que va con `prisma` crudo).
- Índice Prisma por cada `where` nuevo en hot path; paginar todo `findMany` que pueda superar ~100 filas (regla COSTS.md).
- Gates de plan en `packages/config/src/constants.ts` (`PLANS.*.limits` / `features`) + verificación server-side en `lib/plan-limits.ts`, nunca solo UI.
- `tsc --noEmit` en cero antes de cerrar cada fase: `corepack pnpm --filter web exec tsc --noEmit`.
- Jobs programados se agregan al endpoint cron existente `app/api/webhooks/notifications/route.ts` (param `?job=`, auth `Bearer CRON_SECRET`).

---

## Fase 1 — Quick wins (est. 2–3 días)

### 1.1 Control de ocupación

**Qué**: % de agenda ocupada por barbero y por día/semana, en reportes y dashboard.

- **Datos**: ya existen. Capacidad = minutos de `BarberSchedule` menos `BarberTimeOff`; ocupado = suma de duración de `Appointment` en estados SCHEDULED/CONFIRMED/IN_PROGRESS/COMPLETED. Sin migración.
- **Backend**: nueva función en `lib/reports.ts` (`computeOccupancy(range)`), reutilizando los buckets día/semana/mes existentes. Exponer en `app/api/analytics/dashboard/route.ts` (ocupación de hoy y de la semana).
- **UI**:
  - Widget en dashboard: "Ocupación hoy: 62%" con desglose por barbero.
  - Sección en `app/(dashboard)/reportes/page.tsx`: ocupación en el tiempo + heatmap simple día×hora para detectar horas muertas.
- **Gate**: todos los planes ven ocupación global; desglose por barbero e histórico solo PRO+ (cae bajo "reportes avanzados" ya definido).
- **Aceptación**: barbero con horario 10:00–19:00 y 3 citas de 60 min muestra 33% ese día; time-off descuenta capacidad.

### 1.2 Cron de cumpleaños

**Qué**: activar el trigger `BIRTHDAY` que ya existe en `CampaignTrigger` y el template `birthday` que ya existe en `lib/notifications/templates.ts`.

- **Backend**: `processBirthdays()` en `lib/notifications/jobs.ts`: clientes con `birthDate` cuyo día/mes coincide con hoy (timezone del tenant), tenant con campaña `BIRTHDAY` activa. Idempotencia vía `NotificationLog` (no reenviar si ya hay log del mismo template para ese cliente este año) — misma regla que recordatorios.
- **Cron**: nuevo `?job=birthdays` en el endpoint cron, 1 vez al día (ej. 09:00 hora Chile).
- **Canal**: respeta la degradación existente en `lib/notifications/channel.ts` (WhatsApp solo PRO+ con cupo; resto email).
- **Índice**: evaluar índice sobre `Client(tenantId, birthDate)`; si el extract día/mes no es indexable, filtrar por mes en SQL y afinar en memoria (volumen bajo: cumpleaños del día).
- **Aceptación**: cliente con cumpleaños hoy recibe 1 solo mensaje aunque el job corra dos veces.

### 1.3 Google Analytics / Meta Pixel

**Qué**: el tenant pega sus IDs y el storefront público los inyecta. AgendaPro lo cobra como addon "contáctanos"; aquí es diferenciador PRO.

- **Migración**: `Tenant.gaMeasurementId String?`, `Tenant.metaPixelId String?`.
- **Backend**: validar formato server-side (`G-XXXXXXX` / numérico) al guardar en settings; usar `prisma` crudo (modelo `Tenant`).
- **UI settings**: campos en tab "Barbería" (`components/settings/tenant-settings-form.tsx`), visibles solo PRO+ (con upsell si no).
- **Storefront**: en `app/reservar/[slug]/page.tsx` (y flujo de reserva) inyectar gtag/pixel con `next/script` `strategy="afterInteractive"` solo si el tenant tiene ID **y** su plan lo permite (gate server-side al leer el tenant, no en cliente). Eventos mínimos: page_view + evento de conversión al confirmar reserva (`book` exitoso).
- **Aceptación**: tenant PRO con GA configurado emite page_view y evento de reserva; tenant FREE con ID guardado de antes NO inyecta scripts.

---

## Fase 2 — Marketing (est. 3–4 días)

### 2.1 Editor de campañas (UI + API)

**Qué**: el motor de automatización ya corre por cron (`processInactiveRecalls`, recordatorios); las campañas hoy solo nacen del seed. Falta CRUD.

- **API**: `app/api/campaigns/route.ts` (GET paginado, POST) y `app/api/campaigns/[id]/route.ts` (PATCH, DELETE). Guard `requireManager`. Validar `trigger` ∈ `CampaignTrigger`, `channel` ∈ `NotificationChannel` (rechazar SMS: sin provider), `templateKey` ∈ templates registrados.
- **UI**: convertir `app/(dashboard)/marketing/page.tsx` de solo-lectura a gestión: crear, editar, activar/pausar (switch con `active`), y para RECALL_INACTIVE exponer condición de días de inactividad (hoy fija en 30) vía `Campaign.conditions` JSON.
- **Envío manual (trigger MANUAL)**: acción "enviar ahora" a un segmento simple (todos / inactivos ≥N días / con cumpleaños este mes). Ejecutar en batch con la misma degradación de canal y cupo WhatsApp; registrar todo en `NotificationLog`. Límite duro por envío (ej. 500 destinatarios por batch) para no reventar cupos ni timeouts — paginar el envío.
- **Gate**: módulo marketing completo es PRO+ (ya definido en `PLANS`); FREE/STARTER ven la página con upsell.
- **Aceptación**: crear campaña recall a 45 días desde la UI → el cron la ejecuta con esa condición; pausar la detiene; envío manual a segmento queda logueado e idempotente.

---

## Fase 3 — Caja, productos y giftcards (est. 2–3 semanas)

Brecha #1 vs AgendaPro (cubre 4 features suyas: sistema de caja, control de inventarios, alertas de stock, giftcards). Se hace en tres pasos incrementales que se sirven mutuamente.

### 3.1 Productos e inventario

- **Modelos**:
  ```prisma
  model Product {
    id        String  @id @default(cuid())
    tenantId  String
    name      String
    price     Int          // CLP
    cost      Int?         // costo para margen en reportes
    stock     Int     @default(0)
    minStock  Int     @default(0)   // umbral de alerta
    active    Boolean @default(true)
    imageUrl  String?
    // relaciones + @@index([tenantId, active])
  }
  model StockMovement {
    id        String   @id @default(cuid())
    tenantId  String
    productId String
    delta     Int          // + entrada, - venta/ajuste
    reason    StockMovementReason  // PURCHASE | SALE | ADJUSTMENT | RETURN
    saleId    String?
    createdAt DateTime @default(now())
    @@index([tenantId, productId, createdAt])
  }
  ```
- **UI**: página `app/(dashboard)/productos/page.tsx` (CRUD, stock actual, entrada de mercadería). Imagen de producto reutiliza pipeline R2 existente **con compresión + thumbnail** (regla COSTS.md).
- **Alertas de stock**: al registrar venta/ajuste, si `stock <= minStock` crear notificación in-app (banner en dashboard) — sin WhatsApp/email para no gastar cupo. Badge en nav de productos con conteo de alertas.
- **Gate**: STARTER+ (igual que AgendaPro, que lo da desde "Básico"). FREE ve upsell.

### 3.2 Caja / registro de ventas

- **Modelos**:
  ```prisma
  model Sale {
    id            String   @id @default(cuid())
    tenantId      String
    clientId      String?      // opcional: venta de mostrador anónima
    appointmentId String?      // venta adjunta a una cita
    barberId      String?      // quién vendió (para comisión de productos, futuro)
    total         Int
    paymentMethod SalePaymentMethod  // CASH | CARD | TRANSFER | OTHER
    createdAt     DateTime @default(now())
    items         SaleItem[]
    @@index([tenantId, createdAt])
  }
  model SaleItem {
    id        String @id @default(cuid())
    saleId    String
    productId String?   // producto físico
    serviceId String?   // servicio suelto sin cita (ej. venta rápida)
    name      String    // snapshot del nombre al momento de venta
    unitPrice Int       // snapshot del precio
    qty       Int
  }
  ```
  Venta descuenta stock vía `StockMovement` en la misma transacción.
- **UI**:
  - Página `app/(dashboard)/caja/page.tsx`: venta rápida (buscar producto/servicio, carrito mínimo, método de pago) + listado del día con total por método.
  - En el flujo "completar cita" de la agenda: opción "agregar productos" para adjuntar venta a la cita.
  - **Sin apertura/cierre de caja formal en v1** (arqueo, fondo inicial): se pospone; el resumen diario por método de pago cubre el 90% del caso barbería.
- **Reportes**: `lib/reports.ts` suma ingresos por productos como serie separada de servicios (ingresos totales = citas COMPLETED + ventas). Ticket promedio pasa a considerar ambos. Export CSV incluye ventas.
- **Roles**: STAFF y manager operan caja; BARBER no (consistente con "BARBER solo lo suyo").
- **Gate**: STARTER+ (misma llave que productos).
- **Aceptación**: venta de 2 productos descuenta stock, aparece en caja del día y en reportes; cita completada con producto adjunto suma ambos montos.

### 3.3 Giftcards

- **Modelo**:
  ```prisma
  model GiftCard {
    id           String   @id @default(cuid())
    tenantId     String
    code         String        // corto, legible (ej. NVX-8F3K2), único por tenant
    initialValue Int
    balance      Int
    buyerName    String?
    buyerEmail   String?
    recipientName String?
    message      String?
    status       GiftCardStatus  // PENDING_PAYMENT | ACTIVE | REDEEMED | EXPIRED | CANCELLED
    expiresAt    DateTime?       // default: 1 año
    paymentId    String?
    @@unique([tenantId, code])
  }
  ```
- **Compra pública**: página `app/reservar/[slug]/giftcard` → elegir monto (presets + libre) → pago reutilizando el flujo existente de `lib/payments.ts` + `/pagar/[token]` (Webpay/mock, mismo patrón token HMAC). Al confirmar pago: estado ACTIVE, email al comprador con el código (template nuevo en `templates.ts`).
- **Canje**: campo "código giftcard" en el paso "Tus datos" del wizard de reserva (descuenta del abono/total) y en la caja (3.2) como método de pago parcial. Canje descuenta `balance` en transacción; saldo parcial permitido.
- **Gestión**: listado en dashboard (dentro de caja o marketing) con estado y saldo; anular.
- **Gate**: PRO+ (AgendaPro lo da en Premium; aquí empuja upgrade a PRO).
- **Aceptación**: compra de giftcard $20.000 → código llega por email → canje de $12.000 en una reserva deja balance $8.000 → segundo canje por el resto marca REDEEMED. Giftcard PENDING_PAYMENT expirada por TTL libera sin activar código.

---

## Fase 4 — Storefront (est. 1–2 semanas, después de validar Fases 1–3)

### 4.1 Colores personalizados del storefront

- **Migración**: `Tenant.brandPrimary String?`, `Tenant.brandAccent String?` (hex).
- **Implementación**: el layout de `/reservar/[slug]` (y páginas públicas hijas: gestión, pago, reseña, giftcard) inyecta CSS custom properties (`--brand-primary`, `--brand-accent`) que sobreescriben los tokens de `BRAND_COLORS` solo en el árbol público. Dashboard no cambia.
- **Guardas**: validar hex server-side; verificación de contraste AA contra fondo (la medición de accesibilidad recién cerrada no debe regresionar — si el color elegido no pasa AA sobre blanco, ajustar tono automáticamente o advertir).
- **UI settings**: 2 color pickers + preview en vivo del storefront en tab "Barbería". Gate PRO+ (equivale al "Premium" de AgendaPro).
- **Aceptación**: tenant cambia primario → botones/CTAs del storefront cambian; contraste de texto sobre botón sigue AA; tenant FREE mantiene paleta navaxa.

### 4.2 Marketplace (índice público de barberías)

Técnicamente barato; su valor depende de masa de tenants. Se implementa al final y liviano.

- **Página**: `app/reservar/page.tsx` — grilla de tenants `active && bookingEnabled` con logo, nombre, ciudad, rating (Google + interno), link a su storefront. Filtro por ciudad + búsqueda por nombre. Paginado.
- **Opt-out**: `Tenant.marketplaceVisible Boolean @default(true)` — algunos locales no querrán listarse.
- **SEO**: metadata + JSON-LD `ItemList`; agregar al sitemap existente (ya tiene ISR 1h).
- **Gate**: gratis para todos los planes (como AgendaPro: es adquisición para la plataforma, no feature de pago).
- **Aceptación**: `/reservar` lista tenants visibles con paginación; tenant con `marketplaceVisible=false` no aparece pero su slug directo sigue funcionando.

---

## Resumen de gates por plan (delta)

| Feature | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| Ocupación (global) | ✓ | ✓ | ✓ | ✓ |
| Ocupación por barbero + histórico | — | — | ✓ | ✓ |
| Email cumpleaños | ✓ (email) | ✓ (email) | ✓ (+WhatsApp) | ✓ |
| GA / Meta Pixel | — | — | ✓ | ✓ |
| Editor campañas + envío manual | — | — | ✓ | ✓ |
| Productos + inventario + caja | — | ✓ | ✓ | ✓ |
| Giftcards | — | — | ✓ | ✓ |
| Colores storefront | — | — | ✓ | ✓ |
| Marketplace | ✓ | ✓ | ✓ | ✓ |

Actualizar los arrays `features` de `PLANS` en `constants.ts` y la tabla comparativa de `/precios` al cerrar cada fase.

## Orden y dependencias

1. Fase 1 completa (independientes entre sí, paralelizables).
2. Fase 2 (independiente).
3. Fase 3 en orden 3.1 → 3.2 → 3.3 (ventas dependen de productos; giftcard reutiliza pagos y se canjea en caja).
4. Fase 4 al final (4.2 depende de tener tenants reales que listar).

Cada feature cierra con: migración aplicada (dev server detenido antes de `prisma migrate` en Windows), `tsc --noEmit` en cero, y verificación manual del flujo end-to-end.
