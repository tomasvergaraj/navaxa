import { NextResponse } from "next/server";
import { z } from "zod";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const updateSchema = z.object({ hidden: z.boolean() });

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
    await db.review.update({
      where: { id: params.id },
      data: { hidden: parsed.data.hidden },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
