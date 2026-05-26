import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { resolveTenantBySlug } from "@/lib/public-booking";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { id: true, name: true, description: true, durationMin: true, price: true, category: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    tenant: { name: tenant.name, currency: tenant.currency },
    services,
  });
}
