import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { verifyHaircutRatingToken } from "@/lib/haircut-rating";
import { haircutRatingSchema } from "@/lib/validators";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const haircutId = verifyHaircutRatingToken(params.token);
    if (!haircutId) {
      return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 400 });
    }

    const parsed = haircutRatingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // No usa scopedDb: el cliente está sin sesión y el token (HMAC del id) es el auth.
    const updated = await prisma.haircutRecord.update({
      where: { id: haircutId },
      data: { rating: parsed.data.rating, ratedAt: new Date() },
      select: { id: true, rating: true },
    });

    return NextResponse.json({ ok: true, rating: updated.rating });
  } catch (e) {
    return apiError(e);
  }
}
