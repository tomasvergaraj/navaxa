import { NextResponse } from "next/server";
import { z } from "zod";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";
import { completeAppointment } from "@/lib/booking";
import { sendReviewRequest } from "@/lib/reviews";
import { AppointmentStatus } from "@navaxa/db";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  notes: z.string().max(500).optional(),
  cancelReason: z.string().max(200).optional(),
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    const appt = await db.appointment.findFirst({
      where: { id: params.id },
      include: {
        client: true,
        barber: { include: { user: true } },
        services: { include: { service: true } },
      },
    });
    if (!appt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ appointment: appt });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantContext();
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.status === AppointmentStatus.COMPLETED) {
      const result = await completeAppointment(params.id, tenantId);
      // Invitación a reseñar (idempotente; no bloquea la respuesta si falla).
      await sendReviewRequest(params.id, tenantId).catch(() => {});
      return NextResponse.json({ appointment: result });
    }

    const db = scopedDb();
    const data: any = { ...parsed.data };
    if (parsed.data.status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }
    const updated = await db.appointment.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ appointment: updated });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    await db.appointment.update({
      where: { id: params.id },
      data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
