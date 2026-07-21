import { NextResponse } from "next/server";
import { apiError, requireManager } from "@/lib/api-errors";
import { assertGiftCardsPlan } from "@/lib/plan-features";
import { cancelGiftCard } from "@/lib/giftcards";

export const dynamic = "force-dynamic";

/** Anular giftcard (deja de ser canjeable, conserva historial). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireManager();
    await assertGiftCardsPlan(tenantId);
    await cancelGiftCard(tenantId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
