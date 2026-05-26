# Plan — Reserva online del cliente final

> Estado: aprobado. Objetivo: que un cliente reserve hora desde un link público
> de la barbería (elegir servicio → barbero → hora → datos), con confirmación
> automática y opción de cancelar/reagendar, **sin login**.

## Decisiones aprobadas
- **Confirmación inmediata**: la cita nace `SCHEDULED`, `source="booking"`, y se envía `appointment_confirmed`.
- **Barbero**: el cliente puede elegir uno específico **o** "cualquiera disponible" (el sistema asigna uno libre → requiere merge de disponibilidad entre barberos).
- **Gestión**: el cliente puede **cancelar y reagendar** desde un link con token HMAC firmado (stateless, sin login).
- **URL pública**: `/reservar/[slug]` usando `Tenant.slug`. Subdominios quedan para después.
- **Identidad del cliente**: por teléfono → upsert de `Client` por `(tenantId, phone)`.

## Piezas reutilizables (ya existen)
- `getAvailableSlots()` y `createAppointment()` reciben `tenantId` explícito — `apps/web/lib/booking.ts`.
- `tenantDb(tenantId)` para contexto sin request — `apps/web/lib/tenant.ts`.
- `sendNotification({ tenantId, channel, recipient, templateKey, data })` con plantilla `appointment_confirmed` — `apps/web/lib/notifications/`.
- `Tenant.slug` único; `Client` índice `[tenantId, phone]`.

## Cambios de datos (mínimos)
- Migración a `Tenant`: `bookingEnabled Boolean @default(true)` y opcional `bookingNoticeMin Int @default(0)` (anticipación mínima).
- Sin schema para gestión (token firmado) ni para reagendar (es un `update` con revalidación de solape).

## Backend — API pública (fuera del middleware de auth)
1. **Middleware**: agregar `/reservar/` y `/api/public/` a rutas públicas.
2. Helper `resolveTenantBySlug(slug)` → 404 si no existe / `active=false` / `bookingEnabled=false`.
3. `GET /api/public/[slug]/services` → servicios activos (`id, name, durationMin, price`).
4. `GET /api/public/[slug]/barbers` → barberos activos + opción "cualquiera".
5. `GET /api/public/[slug]/availability?barberId|any&date&serviceIds` → reutiliza `getAvailableSlots`. Para "cualquiera": itera barberos, une y deduplica slots por hora (guardando qué barbero queda libre en cada uno).
6. `POST /api/public/[slug]/book` → valida (zod) → upsert `Client` por teléfono → si "cualquiera" elige barbero libre → revalida y llama `createAppointment` (overlap-check en transacción) → dispara `appointment_confirmed` → devuelve `{ appointmentId, manageToken }`. Con **rate-limit** por IP/teléfono.
7. Gestión por token:
   - `GET /api/public/manage/[token]` → ver cita (verifica HMAC).
   - `POST /api/public/manage/[token]/cancel` → `CANCELLED` + `cancelledAt`; notifica `appointment_cancelled`.
   - `POST /api/public/manage/[token]/reschedule` → revalida solape, `update` startsAt/endsAt; notifica.

## Frontend — App Router (layout público propio, sin sidebar)
- `app/reservar/[slug]/page.tsx`: server resuelve tenant (`notFound()` si no) + cabecera de la tienda.
- **Wizard** (client + react-query): Servicio → Barbero (o "cualquiera") → Fecha + Hora → Datos → Confirmar.
- `app/reservar/[slug]/confirmacion`: resumen + link de gestión.
- `app/reservar/gestion/[token]/page.tsx`: ver / cancelar / reagendar.
- En **Configuración** del dashboard: tarjeta "Tu link de reservas" con copiar + QR.

## Integración extra (mismo PR)
- Disparar `appointment_confirmed` también cuando el staff crea la cita en el dashboard (hoy no se notifica al crear).

## Riesgos / deuda
- **Timezone**: `getAvailableSlots` usa `Date` local del server. OK para Chile con server en `America/Santiago`; multi-país requiere normalizar a `Tenant.timezone`.
- **Spam / dobles reservas**: rate-limit + tope de citas futuras por teléfono.
- **Política de cancelación**: ventana mínima opcional (ej. no cancelar < 2h antes).

## Fases
| Fase | Qué | Estimado | Estado |
|---|---|---|---|
| 0 | Migración `bookingEnabled` + middleware público + `resolveTenantBySlug` + validadores zod | ~0.5 d | ✅ hecho |
| 1 | API pública: services, barbers, availability (incl. "cualquiera"), **book** + confirmación | ~1.5 d | ✅ hecho |
| 2 | Storefront + wizard + confirmación | ~2–3 d | ✅ hecho |
| 3 | Gestión por token: ver/cancelar/reagendar + notifs | ~1 d | ✅ hecho |
| 4 | Pulido: rate-limit, link en dashboard, mobile/errores | ~1 d | ✅ hecho |

Tests: unit para el merge de slots "cualquiera" y el overlap en `book`; un e2e del happy path.

---

## Progreso (registro)

### Fase 0 — ✅ hecho
- `Tenant.bookingEnabled` (+ `bookingNoticeMin`) — migración `20260525180004_booking_public`.
- Middleware: `/reservar/` y `/api/public/` ahora son públicos — `apps/web/middleware.ts`.
- `apps/web/lib/public-booking.ts`: `resolveTenantBySlug`, token de gestión HMAC (`signManageToken`/`verifyManageToken`), `getAvailabilityForBarbers` (merge "cualquiera"), `resolveServices`, `activeBarberIds`.
- Validadores: `publicAvailabilitySchema`, `publicBookSchema`, `rescheduleSchema` — `apps/web/lib/validators.ts`.

### Fase 1 — ✅ hecho (probado end-to-end)
- `GET /api/public/[slug]/services` y `/barbers`.
- `POST /api/public/[slug]/availability` (soporta `barberId="any"`, respeta `bookingNoticeMin`).
- `POST /api/public/[slug]/book`: valida, hace upsert de cliente por teléfono, asigna barbero si es "cualquiera", crea cita (`source="booking"`), envía confirmación y devuelve `manageToken`. Limpia cliente huérfano si la reserva falla.
- Confirmación también al crear cita desde el dashboard — `apps/web/app/api/appointments/route.ts`.
- `apps/web/lib/appointment-notify.ts`: elige canal (WhatsApp/email) y formatea fecha/hora en la TZ del tenant.
- **Verificado**: 6 servicios, 3 barberos, 39 slots ("cualquiera"), reserva OK, doble-booking → 409, sin huérfanos, log `appointment_confirmed`/WHATSAPP/SENT.

### Fase 2 — ✅ hecho
- `app/reservar/[slug]/page.tsx`: storefront server-rendered (cabecera de la barbería, 404 si slug inválido, `robots: noindex`).
- `components/booking/booking-wizard.tsx`: wizard 4 pasos (servicio múltiple → barbero o "cualquiera" → día/hora → datos) + confirmación inline con link de gestión. Horas formateadas en la TZ del tenant.
- Verificado: `/reservar/barberia-don-pepe` → 200; slug inexistente → 404.

### Fase 3 — ✅ hecho (probado end-to-end)
- `rescheduleAppointment()` en `lib/booking.ts` (preserva duración, valida solape excluyéndose).
- API por token: `GET /api/public/manage/[token]`, `POST .../cancel`, `POST .../reschedule` (token HMAC).
- `app/reservar/gestion/[token]/page.tsx` + `components/booking/manage-booking.tsx`: ver, cancelar (con confirmación) y reagendar (date-strip + slots).
- Verificado: ver → reagendar (14:00→15:15) → cancelar → re-cancel 409 → token inválido 404 → página 200.

### Fase 4 — ✅ hecho
- `lib/rate-limit.ts`: limitador en memoria por IP. Aplicado a `book` (8/10min) y `availability` (60/min) → 429.
- `components/booking/booking-link-card.tsx` + tarjeta "Link de reservas" en `configuracion` (pestaña Barbería): muestra `NEXT_PUBLIC_APP_URL/reservar/[slug]` con copiar/abrir; avisa si las reservas están desactivadas.
- Verificado: config autenticada muestra el link (200); rate-limit dispara 429 en el intento #61; reserva de regresión OK.

### Pendiente / siguiente
- **QR** del link de reservas (requiere agregar dependencia `qrcode`; se omitió para no tocar deps).
- UI para que el dueño **active/desactive** `bookingEnabled` y edite `bookingNoticeMin` (hoy solo por BD).
- Tests automatizados (unit del merge "cualquiera" y overlap; e2e del happy path) — se validó manualmente vía API.

### Bloqueadores de build — ✅ corregidos
- `scopedDb().create` sin tenant en `barbers`/`services`: se agregó `tenantId` explícito (mismo valor que inyecta la extensión).
- `middleware.ts`: `secret: process.env.AUTH_SECRET!` + `salt` explícito (= nombre de cookie de sesión, default de Auth.js v5). Auth verificada tras el cambio.
- `/login`: `useSearchParams()` ahora envuelto en `<Suspense>` (rompía el prerender en `next build`).
- Resultado: `next build` pasa compilación, type-check, lint y generación de las 14 páginas. (En Windows local falla solo el copiado de `output: "standalone"` por symlinks — `EPERM`; funciona en Linux/Docker.)

### Deuda conocida
- Timezone: `getAvailableSlots` calcula con hora local del server (ok para Chile).
