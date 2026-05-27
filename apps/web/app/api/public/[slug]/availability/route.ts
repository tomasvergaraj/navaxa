import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { publicAvailabilitySchema } from "@/lib/validators";
import { getAvailableSlots } from "@/lib/booking";
import {
  resolveTenantBySlug,
  resolveServices,
  activeBarberIds,
  getAvailabilityForBarbers,
  type AnySlot,
} from "@/lib/public-booking";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const limit = rateLimit(`avail:${params.slug}:${clientIp(req)}`, 60, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    }

    const tenant = await resolveTenantBySlug(params.slug);
    if (!tenant) return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });

    const parsed = publicAvailabilitySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { barberId, date, serviceIds } = parsed.data;

    const services = await resolveServices(tenant.id, serviceIds);
    if (!services) return NextResponse.json({ error: "Servicios inválidos" }, { status: 400 });
    const durationMin = services.reduce((s, x) => s + x.durationMin, 0);

    const day = new Date(date);
    let slots: AnySlot[];

    if (barberId === "any") {
      const ids = await activeBarberIds(tenant.id);
      slots = await getAvailabilityForBarbers(ids, day, durationMin);
    } else {
      const ids = await activeBarberIds(tenant.id);
      if (!ids.includes(barberId)) {
        return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
      }
      const base = await getAvailableSlots({ barberId, date: day, durationMin });
      slots = base.map((s) => ({ ...s, barberId }));
    }

    // Respeta la anticipación mínima configurada por la barbería.
    if (tenant.bookingNoticeMin > 0) {
      const minStart = addMinutes(new Date(), tenant.bookingNoticeMin);
      slots = slots.filter((s) => s.startsAt >= minStart);
    }

    return NextResponse.json({ durationMin, slots });
  } catch (e) {
    return apiError(e);
  }
}
