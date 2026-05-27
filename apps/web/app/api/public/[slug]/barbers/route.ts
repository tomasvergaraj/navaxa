import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { resolveTenantBySlug } from "@/lib/public-booking";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const tenant = await resolveTenantBySlug(params.slug);
    if (!tenant) return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });

    const barbers = await prisma.barber.findMany({
      where: { tenantId: tenant.id, active: true },
      select: {
        id: true,
        avatarUrl: true,
        specialties: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      barbers: barbers.map((b) => ({
        id: b.id,
        name: b.user.name,
        avatarUrl: b.avatarUrl,
        specialties: b.specialties,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
