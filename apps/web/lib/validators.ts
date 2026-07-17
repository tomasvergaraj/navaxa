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
  bookingEnabled: z.boolean().optional(),
  bookingNoticeMin: z.coerce.number().int().min(0).max(10080).optional(), // hasta 7 días
  paymentsEnabled: z.boolean().optional(),
  depositType: z.enum(["NONE", "FIXED", "PERCENT"]).optional(),
  depositValue: z.coerce.number().int().min(0).max(10_000_000).optional(),
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
