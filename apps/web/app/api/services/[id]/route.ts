import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { serviceCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    requireManager();
    const parsed = serviceCreateSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const service = await db.service.update({
      where: { id: params.id },
      data: parsed.data as any,
    });
    return NextResponse.json({ service });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    requireManager();
    const db = scopedDb();
    await db.service.update({
      where: { id: params.id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
