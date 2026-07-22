import { z } from "zod";
import { isValidRut } from "./rut";

const phoneRegex = /^\+?[0-9\s\-()]{8,20}$/;

export const phoneSchema = z
  .string()
  .regex(phoneRegex, "Teléfono inválido")
  .optional()
  .or(z.literal(""));

export const emailSchema = z.string().email("Email inválido").optional().or(z.literal(""));

export const rutSchema = z
  .string()
  .refine((v) => v === "" || isValidRut(v), "RUT inválido")
  .optional()
  .or(z.literal(""));

export const clientCreateSchema = z.object({
  firstName: z.string().min(1, "Requerido").max(80),
  lastName: z.string().max(80).optional().or(z.literal("")),
  phone: phoneSchema,
  email: emailSchema,
  rut: rutSchema,
  birthDate: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
});

export const clientUpdateSchema = clientCreateSchema.partial();

// null = limpiar el campo, undefined = no tocar. La UI (edit-client-dialog)
// manda null cuando el usuario eligió "—" en un select previamente seteado.
export const clientPreferenceSchema = z.object({
  hairType: z.enum(["straight", "wavy", "curly", "coily"]).nullable().optional(),
  preferredStyle: z.string().max(80).nullable().optional(),
  fadeType: z.enum(["low", "mid", "high", "skin", "taper", "none"]).nullable().optional(),
  topLength: z.enum(["short", "medium", "long"]).nullable().optional(),
  beardStyle: z.string().max(80).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  preferredBarberId: z.string().cuid().nullable().optional(),
});

export const serviceCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  price: z.coerce.number().int().min(0),
  durationMin: z.coerce.number().int().min(5).max(480),
  category: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color hex inválido")
    .optional(),
  active: z.boolean().default(true),
});

export const barberCreateSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  // Sin contraseña: se invita por link y el barbero define su propia clave.
  bio: z.string().max(500).optional(),
  commissionRate: z.coerce.number().min(0).max(1).default(0.4),
  specialties: z.array(z.string()).default([]),
  instagram: z.string().max(80).optional(),
});

export const appointmentCreateSchema = z.object({
  clientId: z.string().cuid(),
  barberId: z.string().cuid(),
  startsAt: z.string().datetime(),
  serviceIds: z.array(z.string().cuid()).min(1),
  notes: z.string().max(500).optional(),
  source: z.enum(["web", "walkin", "phone", "whatsapp"]).default("web"),
});

export const haircutPhotoMetaSchema = z.object({
  notes: z.string().max(500).optional(),
  style: z.string().max(80).optional(),
  barberId: z.string().cuid().optional(),
});

export const haircutRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const availabilityQuerySchema = z.object({
  barberId: z.string().cuid(),
  date: z.string().datetime(),
  serviceIds: z.array(z.string().cuid()).min(1),
});

// ---- Reservas públicas (cliente final, sin login) ----
const barberIdOrAny = z.union([z.string().cuid(), z.literal("any")]);

// En reservas públicas el teléfono es obligatorio (es la identidad del cliente).
const requiredPhoneSchema = z.string().regex(phoneRegex, "Teléfono inválido");

export const publicAvailabilitySchema = z.object({
  barberId: barberIdOrAny,
  date: z.string().datetime(),
  serviceIds: z.array(z.string().cuid()).min(1),
});

export const publicBookSchema = z.object({
  barberId: barberIdOrAny,
  startsAt: z.string().datetime(),
  serviceIds: z.array(z.string().cuid()).min(1),
  notes: z.string().max(500).optional(),
  client: z.object({
    firstName: z.string().min(1, "Requerido").max(80),
    lastName: z.string().max(80).optional().or(z.literal("")),
    phone: requiredPhoneSchema,
    email: emailSchema,
  }),
  // Token del widget de Turnstile. Opcional en el schema porque el captcha es
  // opt-in por entorno; si hay llaves, la ruta lo exige (ver lib/turnstile.ts).
  captchaToken: z.string().max(4096).optional(),
});

export const rescheduleSchema = z.object({
  startsAt: z.string().datetime(),
});

export const teamUpdateSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "BARBER", "STAFF"]).optional(),
  active: z.boolean().optional(),
});

export const scheduleSchema = z.object({
  windows: z
    .array(
      z
        .object({
          weekday: z.coerce.number().int().min(0).max(6),
          startMin: z.coerce.number().int().min(0).max(1440),
          endMin: z.coerce.number().int().min(0).max(1440),
        })
        .refine((w) => w.startMin < w.endMin, "La hora de inicio debe ser menor a la de término"),
    )
    .max(50),
});

export const tenantUpdateSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(80).optional(),
  rut: rutSchema,
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  timezone: z.string().min(1).max(64).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  instagram: z.string().max(120).optional().or(z.literal("")),
  website: z.string().max(200).optional().or(z.literal("")),
  googlePlaceId: z.string().trim().max(300).optional().or(z.literal("")),
  // Analítica del sitio público (plan PRO+).
  gaMeasurementId: z
    .string()
    .trim()
    .regex(/^G-[A-Z0-9]{4,14}$/i, "ID de Google Analytics inválido (formato G-XXXXXXXXXX)")
    .optional()
    .or(z.literal("")),
  metaPixelId: z
    .string()
    .trim()
    .regex(/^\d{5,20}$/, "ID de Meta Pixel inválido (solo números)")
    .optional()
    .or(z.literal("")),
  // Color de marca del storefront (PRO+); vacío = paleta navaxa.
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (formato #RRGGBB)")
    .optional()
    .or(z.literal("")),
  marketplaceVisible: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  bookingNoticeMin: z.coerce.number().int().min(0).max(10080).optional(), // hasta 7 días
  paymentsEnabled: z.boolean().optional(),
  depositType: z.enum(["NONE", "FIXED", "PERCENT"]).optional(),
  depositValue: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

// ---- Productos, inventario y caja ----
export const productSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  price: z.coerce.number().int().min(0).max(10_000_000),
  cost: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  minStock: z.coerce.number().int().min(0).max(100_000).optional(),
  active: z.boolean().optional(),
});

/** Entrada de mercadería o ajuste manual (las ventas mueven stock por su lado). */
export const stockMovementSchema = z.object({
  delta: z.coerce
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((v) => v !== 0, "El movimiento no puede ser 0"),
  reason: z.enum(["PURCHASE", "ADJUSTMENT"]),
  note: z.string().trim().max(200).optional(),
});

const saleItemSchema = z
  .object({
    productId: z.string().optional(),
    serviceId: z.string().optional(),
    qty: z.coerce.number().int().min(1).max(99),
  })
  .refine((i) => (i.productId ? !i.serviceId : !!i.serviceId), {
    message: "Cada línea es un producto O un servicio",
  });

export const saleCreateSchema = z.object({
  items: z.array(saleItemSchema).min(1).max(30),
  // GIFTCARD no se acepta desde el cliente: lo deriva el server cuando el saldo
  // cubre el total. Acá viaja el método del resto en dinero.
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  clientId: z.string().optional(),
  appointmentId: z.string().optional(),
  barberId: z.string().optional(),
  giftCardCode: z.string().trim().min(4).max(20).optional(),
  note: z.string().trim().max(200).optional(),
});

// ---- Gift cards ----
export const giftCardIssueSchema = z.object({
  amount: z.coerce.number().int().min(1000, "Mínimo $1.000").max(1_000_000),
  buyerName: z.string().trim().max(80).optional(),
  recipientName: z.string().trim().max(80).optional(),
  recipientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  message: z.string().trim().max(300).optional(),
  // Meses de validez (0 = sin vencimiento). Default 12.
  expiresInMonths: z.coerce.number().int().min(0).max(60).optional(),
});

export const giftCardRedeemSchema = z.object({
  amount: z.coerce.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

// ---- Campañas de marketing ----
// El canal SMS no tiene provider real (degrada a WhatsApp/mock): no se ofrece.
const campaignChannelSchema = z.enum(["WHATSAPP", "EMAIL"]);

/** Habilita una automatización del catálogo (ver lib/campaigns.ts). */
export const campaignCreateSchema = z.object({
  automationKey: z.enum(["reminder_24h", "reminder_1h", "recall", "birthday"]),
});

export const campaignUpdateSchema = z.object({
  active: z.boolean().optional(),
  channel: campaignChannelSchema.optional(),
  // Solo se admite el umbral de reactivación; el resto de conditions se preserva.
  daysSinceLastVisit: z.coerce.number().int().min(15).max(180).optional(),
});

export const broadcastSchema = z.object({
  segment: z.enum(["all", "inactive", "birthday_month"]),
  days: z.coerce.number().int().min(15).max(365).default(30),
  templateKey: z.enum(["recall_30d", "birthday", "thanks_post_visit"]),
  channel: campaignChannelSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(80),
});

export const registerSchema = z.object({
  shopName: z.string().min(2).max(80),
  ownerName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(80),
  phone: phoneSchema,
});
