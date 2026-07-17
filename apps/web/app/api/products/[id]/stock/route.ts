import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { assertProductsPlan } from "@/lib/plan-features";
import { stockMovementSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Entrada de mercadería o ajuste manual. Las ventas descuentan stock por su lado. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = requireManager();
    await assertProductsPlan(tenantId);
    const parsed = stockMovementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { delta, reason, note } = parsed.data;

    const db = scopedDb();
    const existing = await db.product.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const product = await prisma.$transaction(async (tx) => {
      // Guard: un ajuste negativo no puede dejar el stock bajo cero.
      const updated = await tx.product.updateMany({
        where: { id: existing.id, stock: { gte: delta < 0 ? -delta : 0 } },
        data: { stock: { increment: delta } },
      });
      if (updated.count === 0) {
        throw Object.assign(new Error("El ajuste dejaría el stock en negativo"), { status: 409 });
      }
      await tx.stockMovement.create({
        data: { tenantId, productId: existing.id, delta, reason, note: note || null },
      });
      return tx.product.findUnique({ where: { id: existing.id } });
    });

    return NextResponse.json({ product });
  } catch (e) {
    if ((e as { status?: number }).status === 409) {
      return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    }
    return apiError(e);
  }
}
