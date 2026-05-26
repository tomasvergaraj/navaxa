import { NextResponse } from "next/server";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";
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
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const parsed = serviceCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const service = await db.service.create({ data: { ...parsed.data, tenantId } });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
