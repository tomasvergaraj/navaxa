import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager, requireRole } from "@/lib/api-errors";
import { assertProductsPlan } from "@/lib/plan-features";
import { productSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Listado para gestión y caja (STAFF también vende, por eso no es manager-only). */
export async function GET() {
  try {
    const { tenantId } = requireRole(["OWNER", "ADMIN", "STAFF"]);
    await assertProductsPlan(tenantId);
    const db = scopedDb();
    const products = await db.product.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 500,
    });
    return NextResponse.json({ products });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = requireManager();
    await assertProductsPlan(tenantId);
    const parsed = productSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const product = await db.product.create({
      data: {
        tenantId,
        name: parsed.data.name,
        price: parsed.data.price,
        cost: parsed.data.cost ?? null,
        minStock: parsed.data.minStock ?? 0,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
