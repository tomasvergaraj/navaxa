import { NextResponse } from "next/server";
import { z } from "zod";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const updateSchema = z.object({ hidden: z.boolean() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    requireManager();
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
    return apiError(e);
  }
}
