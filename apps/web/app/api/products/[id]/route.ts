import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { assertProductsPlan } from "@/lib/plan-features";
import { productSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireManager();
    await assertProductsPlan(tenantId);
    const parsed = productSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const existing = await db.product.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const d = parsed.data;
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: d.name,
        price: d.price,
        cost: d.cost === undefined ? undefined : d.cost,
        minStock: d.minStock,
        active: d.active,
      },
    });
    return NextResponse.json({ product });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Con historial (ventas o movimientos de stock) el producto se desactiva en vez
 * de borrarse, para no perder trazabilidad; sin historial se elimina de verdad.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireManager();
    await assertProductsPlan(tenantId);
    const db = scopedDb();
    const existing = await db.product.findFirst({
      where: { id: params.id },
      select: {
        id: true,
        _count: { select: { movements: true, saleItems: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const hasHistory = existing._count.movements > 0 || existing._count.saleItems > 0;
    if (hasHistory) {
      await prisma.product.update({ where: { id: existing.id }, data: { active: false } });
      return NextResponse.json({ ok: true, deactivated: true });
    }
    await prisma.product.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, deactivated: false });
  } catch (e) {
    return apiError(e);
  }
}
