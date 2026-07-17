import { prisma } from "@navaxa/db";
import { getAvailableSlots, type Slot } from "@/lib/booking";
import { signToken, verifyToken, TOKEN_TTL } from "@/lib/signed-token";

/**
 * Resuelve una barbería por su slug para el flujo público de reservas.
 * Devuelve null si no existe, está inactiva o tiene las reservas online apagadas.
 */
export async function resolveTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { slug, active: true, bookingEnabled: true },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      logoUrl: true,
      coverUrl: true,
      description: true,
      instagram: true,
      website: true,
      address: true,
      city: true,
      phone: true,
      timezone: true,
      currency: true,
      bookingNoticeMin: true,
      paymentsEnabled: true,
      depositType: true,
      depositValue: true,
      googlePlaceId: true,
      gaMeasurementId: true,
      metaPixelId: true,
      googleRating: true,
      googleReviewCount: true,
      googleMapsUri: true,
      googleReviews: true,
    },
  });
  return tenant;
}

export type PublicTenant = NonNullable<Awaited<ReturnType<typeof resolveTenantBySlug>>>;

/** Valida que todos los serviceIds existan, sean del tenant y estén activos. */
export async function resolveServices(tenantId: string, serviceIds: string[]) {
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, tenantId, active: true },
    select: { id: true, durationMin: true, price: true },
  });
  if (services.length !== serviceIds.length) return null;
  return services;
}

/** IDs de los barberos activos del tenant. */
export async function activeBarberIds(tenantId: string): Promise<string[]> {
  const barbers = await prisma.barber.findMany({
    where: { tenantId, active: true },
    select: { id: true },
  });
  return barbers.map((b) => b.id);
}

export interface DayHours {
  weekday: number; // 0=domingo .. 6=sábado
  startMin: number;
  endMin: number;
}

/**
 * Horario de atención de la barbería: por cada día, el rango en que hay al menos
 * un barbero disponible (mínimo inicio / máximo término entre los barberos activos).
 */
export async function getPublicHours(tenantId: string): Promise<DayHours[]> {
  const barbers = await prisma.barber.findMany({
    where: { tenantId, active: true },
    select: { id: true },
  });
  const ids = barbers.map((b) => b.id);
  if (ids.length === 0) return [];

  const schedules = await prisma.barberSchedule.findMany({
    where: { barberId: { in: ids } },
    select: { weekday: true, startMin: true, endMin: true },
  });

  const byDay = new Map<number, { startMin: number; endMin: number }>();
  for (const s of schedules) {
    const cur = byDay.get(s.weekday);
    if (!cur) byDay.set(s.weekday, { startMin: s.startMin, endMin: s.endMin });
    else
      byDay.set(s.weekday, {
        startMin: Math.min(cur.startMin, s.startMin),
        endMin: Math.max(cur.endMin, s.endMin),
      });
  }

  return [...byDay.entries()]
    .map(([weekday, v]) => ({ weekday, ...v }))
    .sort((a, b) => a.weekday - b.weekday);
}

// ---- Token de gestión (stateless, sin login) ----
export function signManageToken(appointmentId: string): string {
  return signToken("manage", appointmentId, TOKEN_TTL.manage);
}

export function verifyManageToken(token: string): string | null {
  return verifyToken("manage", token);
}

/** Carga una cita a partir de su token de gestión. Devuelve null si el token es inválido o la cita no existe. */
export async function loadAppointmentByToken(token: string) {
  const appointmentId = verifyManageToken(token);
  if (!appointmentId) return null;
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, plan: true, address: true, timezone: true, bookingNoticeMin: true },
      },
      barber: { include: { user: { select: { name: true } } } },
      client: { select: { firstName: true, phone: true, email: true } },
      services: { include: { service: { select: { id: true, name: true, price: true, durationMin: true } } } },
      payment: { select: { id: true, amount: true, status: true, paidAt: true, expiresAt: true } },
    },
  });
}

// ---- Disponibilidad "cualquier barbero" ----
export interface AnySlot extends Slot {
  barberId: string;
}

/**
 * Une la disponibilidad de varios barberos en una sola lista de slots.
 * Para cada hora de inicio conserva un único barbero (el primero libre),
 * de modo que el front muestra horas sin duplicar y la reserva ya sabe a quién asignar.
 */
export async function getAvailabilityForBarbers(
  barberIds: string[],
  date: Date,
  durationMin: number,
): Promise<AnySlot[]> {
  const perBarber = await Promise.all(
    barberIds.map(async (barberId) => {
      const slots = await getAvailableSlots({ barberId, date, durationMin });
      return slots.map((s) => ({ ...s, barberId }));
    }),
  );

  const byTime = new Map<number, AnySlot>();
  for (const slots of perBarber) {
    for (const s of slots) {
      const key = +s.startsAt;
      if (!byTime.has(key)) byTime.set(key, s);
    }
  }
  return [...byTime.values()].sort((a, b) => +a.startsAt - +b.startsAt);
}
