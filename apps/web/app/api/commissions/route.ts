import { NextResponse } from "next/server";
import { z } from "zod";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const settleSchema = z.object({
  barberId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(0).max(11), // 0-11 (estilo Date de JS)
  paid: z.boolean(),
  method: z.enum(["CASH", "TRANSFER", "OTHER"]).optional(), // método de pago al liquidar
});

/**
 * Liquida (o revierte) las comisiones pendientes de un barbero en un mes.
 * `paid: true`  → marca como pagadas las que estén pendientes.
 * `paid: false` → revierte a pendientes las que estén pagadas.
 */
export async function POST(req: Request) {
  try {
    await requireManager();

    const parsed = settleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { barberId, year, month, paid, method } = parsed.data;

    const db = scopedDb();
    // El período es el mes calendario; se filtra por rango sobre periodStart
    // para no depender de la igualdad exacta del instante almacenado.
    const periodGte = new Date(year, month, 1);
    const periodLt = new Date(year, month + 1, 1);

    const result = await db.commission.updateMany({
      where: {
        barberId,
        periodStart: { gte: periodGte, lt: periodLt },
        paid: !paid, // solo las que cambian de estado
      },
      data: {
        paid,
        paidAt: paid ? new Date() : null,
        paymentMethod: paid ? (method ?? "CASH") : null,
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (e) {
    return apiError(e);
  }
}
