import { NextResponse } from "next/server";
import { apiError, requireManager } from "@/lib/api-errors";
import { assertProductsPlan } from "@/lib/plan-features";
import { cancelSale } from "@/lib/sales";

export const dynamic = "force-dynamic";

/** Anular venta (devuelve stock). Solo gestión: STAFF crea ventas, no las anula. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireManager();
    await assertProductsPlan(tenantId);
    const sale = await cancelSale(tenantId, params.id);
    return NextResponse.json({ sale });
  } catch (e) {
    return apiError(e);
  }
}
