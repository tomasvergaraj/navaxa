import { NextResponse } from "next/server";
import { z } from "zod";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  bio: z.string().max(500).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  specialties: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  instagram: z.string().max(80).optional(),
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    const barber = await db.barber.findFirst({
      where: { id: params.id },
      include: {
        user: true,
        schedule: true,
        timeOff: { where: { endsAt: { gte: new Date() } } },
      },
    });
    if (!barber) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ barber });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const updated = await db.barber.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ barber: updated });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
