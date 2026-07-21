import { NextResponse } from "next/server";
import { z } from "zod";
import { scopedDb } from "@/lib/tenant";
import { apiError, ApiError } from "@/lib/api-errors";
import { viewerScope } from "@/lib/page-guards";
import { completeAppointment, rescheduleAppointment } from "@/lib/booking";
import { sendReviewRequest } from "@/lib/reviews";
import { notifyAppointment } from "@/lib/appointment-notify";
import { AppointmentStatus, prisma } from "@navaxa/db";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  notes: z.string().max(500).optional(),
  cancelReason: z.string().max(200).optional(),
  // Reagendar (drag & drop en la agenda): nuevo inicio y, opcional, otro barbero.
  startsAt: z.string().datetime().optional(),
  barberId: z.string().cuid().optional(),
});

/**
 * Solo el BARBER queda limitado a sus propias citas; gestión (OWNER/ADMIN) y
 * recepción (STAFF) pueden gestionar cualquier cita del local. Devuelve
 * tenantId + ownOnly (true solo para BARBER).
 */
async function assertCanModify(apptId: string): Promise<{ tenantId: string; ownOnly: boolean }> {
  const { ctx, ownOnly, barberId } = await viewerScope();
  if (ownOnly) {
    const appt = await scopedDb().appointment.findFirst({
      where: { id: apptId },
      select: { barberId: true },
    });
    if (!appt || appt.barberId !== barberId) {
      throw new ApiError(403, "Solo puedes gestionar tus propias citas");
    }
  }
  return { tenantId: ctx.tenantId, ownOnly };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    // Leer también es gestionar: la ficha trae nombre y teléfono del cliente, así
    // que un barbero no debe poder abrir la cita de otro adivinando el id (la
    // agenda ya se le filtra en api/appointments).
    await assertCanModify(params.id);
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
    return apiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId, ownOnly } = await assertCanModify(params.id);
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

    // Reagendar: conserva duración, valida solape y pertenencia del barbero destino.
    // Un barbero NO puede reasignar la cita a otro barbero; gestión y recepción sí.
    if (parsed.data.startsAt) {
      const result = await rescheduleAppointment(
        params.id,
        tenantId,
        new Date(parsed.data.startsAt),
        ownOnly ? undefined : parsed.data.barberId,
      );
      return NextResponse.json({ appointment: result });
    }

    const db = scopedDb();
    // Estado previo: para avisar al cliente solo cuando la cita RECIÉN pasa a
    // Confirmada (no en re-guardados que ya estaban confirmados).
    const prev = await db.appointment.findFirst({
      where: { id: params.id },
      select: { status: true },
    });
    const data: any = { ...parsed.data };
    if (parsed.data.status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }
    const updated = await db.appointment.update({
      where: { id: params.id },
      data,
    });

    if (
      parsed.data.status === AppointmentStatus.CONFIRMED &&
      prev?.status !== AppointmentStatus.CONFIRMED
    ) {
      // "Hora confirmada" recién cuando el local confirma desde el panel (al
      // crear la cita se envía "hora agendada"). No bloquea la respuesta.
      const [tenant, appt] = await Promise.all([
        // Tenant no tiene columna tenantId: leerlo con prisma crudo, no scopedDb.
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, name: true, plan: true, address: true, timezone: true },
        }),
        db.appointment.findFirst({
          where: { id: params.id },
          include: { client: true, barber: { include: { user: true } } },
        }),
      ]);
      if (tenant && appt) {
        await notifyAppointment("confirmed", tenant, appt).catch(() => undefined);
      }
    }

    return NextResponse.json({ appointment: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await assertCanModify(params.id);
    const db = scopedDb();
    await db.appointment.update({
      where: { id: params.id },
      data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
