import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireRole } from "@/lib/api-errors";
import { assertProductsPlan, assertGiftCardsPlan } from "@/lib/plan-features";
import { saleCreateSchema } from "@/lib/validators";
import { createSale } from "@/lib/sales";

export const dynamic = "force-dynamic";

// Recepción (STAFF) también opera la caja; BARBER no.
const CASHIER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;

/** Ventas de un día (?date=YYYY-MM-DD, default hoy en el TZ del server = local). */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireRole(CASHIER_ROLES);
    await assertProductsPlan(tenantId);
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const day = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
    if (Number.isNaN(day.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const db = scopedDb();
    const sales = await db.sale.findMany({
      where: { createdAt: { gte: startOfDay(day), lte: endOfDay(day) } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        items: true,
        client: { select: { firstName: true, lastName: true } },
      },
    });
    return NextResponse.json({ sales });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireRole(CASHIER_ROLES);
    await assertProductsPlan(tenantId);
    const parsed = saleCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    // Cobrar con giftcard es feature PRO+, aunque la caja arranque en Starter.
    if (parsed.data.giftCardCode) await assertGiftCardsPlan(tenantId);
    const sale = await createSale({ tenantId, ...parsed.data });
    return NextResponse.json({ sale }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
