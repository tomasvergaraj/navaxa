import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { verifyReviewToken } from "@/lib/reviews";

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
      select: { id: true, tenantId: true, barberId: true, clientId: true, status: true },
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

    return NextResponse.json({ ok: true, id: review.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
