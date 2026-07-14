import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { subHours, addHours } from "date-fns";
import { verifyReviewToken } from "@/lib/reviews";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const appointmentId = verifyReviewToken(params.token);
    if (!appointmentId) {
      return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 400 });
    }

    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, tenantId: true, barberId: true, clientId: true, status: true, startsAt: true },
    });
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    if (appt.status !== AppointmentStatus.COMPLETED) {
      return NextResponse.json({ error: "Aún no puedes reseñar esta cita" }, { status: 409 });
    }

    // El cliente puede actualizar su reseña con el mismo enlace.
    const review = await prisma.review.upsert({
      where: { appointmentId: appt.id },
      create: {
        tenantId: appt.tenantId,
        appointmentId: appt.id,
        clientId: appt.clientId,
        barberId: appt.barberId,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
      update: {
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
      select: { id: true },
    });

    // Un solo rating por visita: la misma nota califica también el corte
    // (alimenta la IA de recomendación). Primero la foto ligada a la cita;
    // si no hay, la más cercana a la hora de la visita (fotos previas al
    // vínculo directo foto↔cita).
    const haircut =
      (await prisma.haircutRecord.findFirst({
        where: { appointmentId: appt.id },
        select: { id: true },
      })) ??
      (await prisma.haircutRecord.findFirst({
        where: {
          tenantId: appt.tenantId,
          clientId: appt.clientId,
          appointmentId: null,
          performedAt: { gte: subHours(appt.startsAt, 6), lte: addHours(appt.startsAt, 48) },
        },
        orderBy: { performedAt: "desc" },
        select: { id: true },
      }));
    if (haircut) {
      await prisma.haircutRecord.update({
        where: { id: haircut.id },
        data: { rating: parsed.data.rating, ratedAt: new Date(), appointmentId: appt.id },
      });
    }

    return NextResponse.json({ ok: true, id: review.id });
  } catch (e) {
    return apiError(e);
  }
}
