# COSTS.md — Guardrails de costos operacionales

> **Para Claude Code:** Este archivo describe las restricciones de costo que debes considerar
> al escribir código nuevo que toque APIs externas (IA, WhatsApp, email, storage, BD).
> Léelo antes de proponer features que invoquen estos servicios y aplica las reglas
> sin necesidad de pedir confirmación.

---

## 0 · Regla maestra

**El 60-70% del costo a escala viene de WhatsApp.** Todo el resto es marginal.
Cuando dudes entre dos diseños, el que reduce mensajes outbound de WhatsApp gana.
La IA (Anthropic) y el storage (R2) son baratos. La BD (Neon) escala a cero.
**No sobrediseñes para optimizar costos que no mueven la aguja.**

---

## 1 · Tarifas vigentes (mayo 2026)

### Anthropic Claude API (USD / millón de tokens)

| Modelo | Input | Output | Cuándo usarlo |
|---|---|---|---|
| **Haiku 4.5** ⭐ default | $1.00 | $5.00 | Recomendación de corte, clasificación, parsing, validaciones semánticas |
| Sonnet 4.6 | $3.00 | $15.00 | Solo si Haiku falla en evaluaciones reales (ver §3.3) |
| Opus 4.7 | $5.00 | $25.00 | **No usar.** Esta app no lo necesita. |

Descuentos aplicables: **prompt caching reduce ~90% el costo del input cacheado**; **batch API da 50% off** (no aplica a UX en tiempo real, sí a jobs).

### WhatsApp (Twilio + Meta) — recipient: Chile

| Categoría | Costo por mensaje (aprox.) | Notas |
|---|---|---|
| **Utility** | ~$0.012-0.017 USD (~$12-16 CLP) | Recordatorios, confirmaciones, post-visita |
| Marketing | ~$0.04-0.06 USD (~$40-60 CLP) | Promos, reactivación — **evitar si es posible reclasificar como utility** |
| Service (dentro de CSW de 24h) | **GRATIS** | Cualquier respuesta libre o utility template |
| Authentication | similar a utility | No aplicable a este producto |

Adicional: **Twilio markup +$0.005 USD por mensaje** sobre la tarifa de Meta.

### Resend (email)

- Free: 3.000 emails/mes, máx 100/día
- Pro: $20/mes, 50.000 emails
- Overage Pro: $0.40 por 1.000 emails extra

### Cloudflare R2 (storage)

- Free: 10 GB storage, 1M ops Class A (write), 10M ops Class B (read)
- Storage: $0.015/GB-mes
- Class A: $4.50/M requests
- Class B: $0.36/M requests
- **Egress: GRATIS** (siempre)

### Neon Postgres

- Free: 100 CU-hours/mes, 0.5 GB storage, autoescala 2 CU
- Launch: $0.106/CU-hora, $0.35/GB-mes storage, mínimo $5/mes
- Scale-to-zero: BD inactiva cuesta $0 en compute

### Vercel

- Hobby: gratis (uso no comercial — **no aplica a Navaxa**)
- Pro: $20/mes/seat, incluye 1 TB bandwidth, ~1.000 GB-hr functions
- Overage bandwidth: $0.15/GB

### NIC Chile (dominio .cl)

- $10.950 CLP/año (~$912 CLP/mes prorrateado)

---

## 2 · Reglas críticas que debes aplicar al escribir código

### 2.1 IA — Anthropic Claude API

**REGLA A1:** El default es **Haiku 4.5** (`claude-haiku-4-5`). Nunca uses Sonnet u Opus
sin justificación explícita en el código o sin que el usuario lo pida.

```ts
// ✅ CORRECTO
const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";

// ❌ INCORRECTO (default caro sin necesidad)
const MODEL = "claude-opus-4-7";
```

**REGLA A2:** Si el prompt del sistema es estable entre llamadas, usa **prompt caching**.
Para Navaxa, el system prompt de `recommendNextHaircut` no cambia → cachéalo.

```ts
// Cabecera para activar cache
"anthropic-beta": "prompt-caching-2024-07-31"

// Marcar el bloque cacheable
system: [{
  type: "text",
  text: SYSTEM_PROMPT,
  cache_control: { type: "ephemeral" }
}]
```

**REGLA A3:** Limita `max_tokens` al mínimo necesario. La recomendación de corte cabe
en ~800 tokens. **No pongas 4096 "por si acaso".** Cada token de output cuesta 5× un input.

**REGLA A4:** Para tareas no interactivas (análisis batch, reportes diarios), usa
**Batch API** (50% off). UX en tiempo real va por la Messages API normal.

**REGLA A5:** Cuando agregues una nueva llamada a la API, registra en el código un
comentario con el costo estimado por invocación:

```ts
// Cost: ~$0.007/call (Haiku 4.5, ~2.5k in + 0.8k out)
// At 1k calls/month: ~$7 USD (~$6.700 CLP)
async function recommendNextHaircut(clientId: string) { ... }
```

### 2.2 WhatsApp — el dolor de cabeza

**REGLA W1: NUNCA crees templates de categoría Marketing si pueden ser Utility.**

| Caso | Categoría correcta |
|---|---|
| "Te recordamos tu hora mañana" | **Utility** |
| "Tu hora quedó confirmada" | **Utility** |
| "¿Qué tal quedó el corte?" | **Utility** |
| "20% off en tu próximo corte 🎉" | Marketing (5× más caro) |
| "Hace un mes que no nos vemos. Reserva" | Utility si redactas neutro, marketing si vendes |

Redacción correcta para reactivación (queda como utility): *"Notamos que pasaron 30
días desde tu última visita. Tu próxima cita disponible: [link]"*. Sin promo, sin
descuento, sin emoji promocional.

**REGLA W2: Diseña flows para abrir la Customer Service Window (CSW) lo antes posible.**

Toda respuesta dentro de las 24h posteriores a un mensaje del cliente es GRATIS.
Si el primer template incluye un botón "Confirmar" y el cliente lo aprieta, los
próximos mensajes en 24h cuestan $0.

```ts
// ✅ Template con botón quick-reply → cliente responde → CSW abierta → free
// ❌ Template puro de texto sin call-to-action → no incentiva respuesta
```

**REGLA W3: Idempotencia obligatoria.** Antes de mandar cualquier notificación,
chequear `NotificationLog` para que no se envíe duplicada (el cron corre cada 15 min
y puede repetir si el job falla a medio camino).

```ts
const already = await prisma.notificationLog.findFirst({
  where: {
    tenantId,
    recipient,
    templateKey,
    createdAt: { gte: subHours(now, 25) },
  },
});
if (already) return; // skip
```

Este patrón ya está en `apps/web/lib/notifications/jobs.ts`. **Replícalo en cualquier
job nuevo.**

**REGLA W4: WhatsApp es feature PRO, no STARTER.** Si una barbería está en plan FREE
o STARTER, el código de notificaciones debe degradar a email-only. Verificar el plan
antes de programar el job.

```ts
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
if (tenant.plan === "FREE" || tenant.plan === "STARTER") {
  // Fallback a email
  return sendNotification({ channel: "EMAIL", ... });
}
```

**REGLA W5: Volumen máximo razonable.** Una barbería sana manda ~250-350 templates
outbound/mes. Si el código va a mandar más, **es un bug** (loop infinito, retry sin
backoff, etc). Considerar rate-limit por tenant.

**REGLA W6: Cupo mensual por plan (implementado).** Cada plan incluye un cupo de
mensajes WhatsApp/mes (`PLANS[plan].limits.whatsappPerMonth`: PRO 1.000, ENTERPRISE
3.000, resto 0). `pickChannel()` (`apps/web/lib/notifications/channel.ts`) lo
enforcea contando `NotificationLog` del mes y degrada a email al agotarse — **toda
notificación nueva debe elegir canal vía `pickChannel()`, nunca hardcodear
WHATSAPP**. Además: review/rating van email-first (no gastan cupo) y el
recordatorio 1h nace desactivado (el 24h es el que reduce no-shows).

### 2.3 Storage (R2)

**REGLA S1: Comprimir imágenes antes de subir.** El cliente sube fotos del celular
que pesan 3-8 MB. Comprimir a ~500 KB antes de R2 ahorra storage y bandwidth a futuro
si migramos a Infrequent Access.

```ts
// En el endpoint de upload (apps/web/app/api/clients/[id]/photos/route.ts)
// Usar sharp para resize + recompresión:
import sharp from "sharp";
const compressed = await sharp(buffer)
  .resize({ width: 1600, height: 1600, fit: "inside" })
  .jpeg({ quality: 80, mozjpeg: true })
  .toBuffer();
```

**REGLA S2:** Generar también thumbnail (300×300) en una sola operación de subida.
Class A ops son 12× más caras que Class B, así que cada upload extra duele.

**REGLA S3: NO uses signed URLs para imágenes públicas.** Las fotos de cortes se
sirven con URLs públicas estables. Signed URLs requieren Class A ops cada vez.

### 2.4 Base de datos (Neon)

**REGLA D1: Aprovechar scale-to-zero.** Evita workers con polling agresivo en BD que
mantengan la BD despierta. El cron de notificaciones corre cada 15 min — eso está bien.
**NO** crear loops de polling cada segundo.

**REGLA D2: Cada nueva query en hot path debe tener su índice.** Revisar `schema.prisma`:
si agregas un `where` por una columna nueva, agrega el `@@index` correspondiente. Sin
índice, las queries escalan compute (cuesta plata) y latencia (mata UX).

**REGLA D3: Paginación obligatoria.** Todo `findMany` que pueda devolver >100 filas
DEBE tener `take` y `skip` o cursor. Sin esto, una consulta dispara compute alto y
puede saturar memoria.

**REGLA D4:** Para reportes/analytics pesados, considera materializar resultados en
una tabla en vez de calcularlos en cada request. Ej: `barber_monthly_stats` agregada
nightly en vez de aggregate en vivo.

### 2.5 Vercel

**REGLA V1: Edge runtime cuando se pueda.** Edge functions tienen un meter distinto
y son más baratas para handlers livianos (auth, redirects). Node runtime solo cuando
necesitas npm packages con dependencias nativas (Prisma client por ejemplo).

```ts
// En el route handler
export const runtime = "edge"; // si el handler lo permite
```

Excepción: cualquier ruta que use Prisma client va con Node runtime obligatoriamente.

**REGLA V2:** No servir imágenes desde Vercel cuando ya están en R2. La regla de
`next.config.mjs` debe apuntar a `cdn.navaxa.cl` directamente para imágenes de cortes,
**no** pasar por el optimizador de Next/Vercel (eso suma bandwidth Vercel).

```tsx
// ✅ next/image sirviendo desde R2 con unoptimized para imágenes que ya están en CDN
<Image src={haircut.imageUrl} unoptimized ... />

// ❌ Pasar la imagen por el optimizador de Vercel duplica el bandwidth
```

**REGLA V3:** ISR/SSG donde sea posible. La landing pública (`/`) y `/precios` son
estáticas — generarlas en build, no en cada request.

---

## 3 · Checklist antes de mergear una feature

Si tu cambio:

- [ ] Llama a Anthropic API → ¿usaste Haiku? ¿Está el prompt caching activo si aplica?
- [ ] Envía un WhatsApp → ¿template aprobado como Utility? ¿Idempotencia? ¿Verificó plan del tenant?
- [ ] Sube archivos → ¿hay compresión previa? ¿generaste thumbnail?
- [ ] Agrega una query nueva → ¿hay índice en la columna del where?
- [ ] Crea un cron/job → ¿corre con la frecuencia mínima necesaria?
- [ ] Toca el bundle del frontend → ¿revisaste el peso? (bandwidth Vercel)

Si la respuesta es "no" a alguna, **arregla antes de pedir review**.

---

## 4 · Cómo estimar el costo de una feature nueva

Cuando alguien proponga una feature (o cuando tú propongas una al usuario), estima
el costo así:

| Tipo de operación | Costo unitario aprox. | Threshold mental |
|---|---|---|
| 1 invocación Claude Haiku (~3k tokens total) | ~$0.01 USD (~$10 CLP) | Si <1.000/mes, ignorable |
| 1 WhatsApp utility template | ~$0.015 USD (~$15 CLP) | Si <500/mes/barbería, ok |
| 1 WhatsApp marketing template | ~$0.05 USD (~$50 CLP) | **Evitar siempre que se pueda** |
| 1 email transaccional | ~$0.0004 USD | Ignorable |
| 1 GB storage R2 | $0.015 USD/mes | Ignorable |
| 1 GB bandwidth Vercel (>1TB) | $0.15 USD | Cuidado con imágenes pesadas |
| 1 CU-hora Neon | $0.106 USD | Ignorable salvo always-on |

**Regla rápida:** si una feature agrega <$0.10 USD de costo por barbería al mes,
no la pienses. Si agrega >$1, justifícala (¿qué precio extra cobramos por ella?).
Si agrega >$5, casi seguro requiere cambiar el pricing del plan.

---

## 5 · Volumetría asumida en los cálculos

Para sanity-check de estimaciones, asumimos estos rangos por barbería activa:

| Métrica | Barbería pequeña | Mediana | Grande |
|---|---|---|---|
| Barberos | 1 | 2-3 | 4-6 |
| Cortes/mes | 80-150 | 200-400 | 500-800 |
| Mensajes WhatsApp outbound/mes | 80-150 | 200-400 | 500-700 |
| Fotos subidas/mes | 60-120 | 150-300 | 400-600 |
| Recomendaciones IA/mes | 10-30 | 40-100 | 100-200 |
| Storage acumulado a 12 meses | ~150 MB | ~400 MB | ~1 GB |

Si tu código asume números muy distintos (10× más, 10× menos), revisa antes de implementar.

---

## 6 · Decisiones de plan por feature

Algunas features no van en todos los planes. La asignación oficial:

| Feature | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| Agenda + clientes básico | ✅ | ✅ | ✅ | ✅ |
| CRM visual (fotos) | ❌ (50 fotos máx) | ✅ | ✅ | ✅ |
| WhatsApp automático | ❌ | ❌ | ✅ | ✅ |
| Email automático | ❌ | ✅ | ✅ | ✅ |
| Recomendación IA | ❌ | ❌ | ✅ | ✅ |
| Comisiones automáticas | ❌ | ❌ | ✅ | ✅ |
| Multi-local | ❌ | ❌ | ❌ | ✅ |

**Antes de implementar una feature nueva, verificar en `packages/config/src/constants.ts`
qué planes deben verla y agregar guards en el código.**

```ts
import { PLANS } from "@navaxa/config";

function canUseAI(tenant: Tenant): boolean {
  return tenant.plan === "PRO" || tenant.plan === "ENTERPRISE";
}
```

---

## 7 · Cuándo escalar (señales tempranas)

Estas señales indican que un costo está empezando a doler y hay que actuar:

| Señal | Acción |
|---|---|
| Anthropic factura > $50 USD/mes | Activar prompt caching si no está; medir si Haiku alcanza |
| WhatsApp > $100 USD/mes a <50 barberías | Revisar templates re-clasificados a marketing; optimizar CSW |
| Vercel bandwidth > 800 GB/mes | Revisar imágenes sirviéndose desde Vercel en vez de R2 |
| Neon storage > 5 GB | Revisar tablas grandes; considerar archivar haircuts antiguos |
| Neon compute > 300 CU-hr/mes | Algún query está manteniendo BD despierta, investigar |

---

## 8 · Cosas que NO se hacen, nunca

- Loggear el contenido completo de las llamadas a la API de Anthropic (incluye datos del cliente).
- Mandar WhatsApp como Marketing sin que el usuario lo apruebe explícitamente.
- Hacer polling de la BD más rápido que cada 30 segundos sin caso de uso justificado.
- Subir imágenes sin comprimir.
- Crear índices nuevos sin medir el impacto en write throughput.
- Defaultear a Sonnet u Opus en código nuevo.

---

## 9 · Cuándo este archivo está desactualizado

Las tarifas cambian. Considera revisar este documento si:

- Pasaron más de 3 meses desde la última actualización (fecha al pie)
- Anthropic anuncia nuevos modelos o cambios de pricing
- Meta cambia el rate card de WhatsApp (suele ser trimestral: Ene/Abr/Jul/Oct)
- Cloudflare o Vercel cambian sus tiers

Si Claude Code detecta que las tarifas en este archivo no calzan con las actuales
después de hacer una búsqueda, **debe avisar al usuario** y proponer actualizar
este documento antes de continuar.

---

*Última actualización: mayo 2026 · Verificado contra docs oficiales de Anthropic,
Meta WhatsApp Business Platform, Resend, Cloudflare R2, Neon, Vercel y NIC Chile.*
