import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { serviceCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = scopedDb();
    const services = await db.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ services });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = requireManager();
    const parsed = serviceCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const service = await db.service.create({ data: { ...parsed.data, tenantId } });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
