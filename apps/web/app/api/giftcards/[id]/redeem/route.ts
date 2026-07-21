import { NextResponse } from "next/server";
import { apiError, requireRole } from "@/lib/api-errors";
import { assertGiftCardsPlan } from "@/lib/plan-features";
import { giftCardRedeemSchema } from "@/lib/validators";
import { redeemGiftCard } from "@/lib/giftcards";

export const dynamic = "force-dynamic";

// Recepción (STAFF) también canjea giftcards en el mostrador; BARBER no.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireRole(["OWNER", "ADMIN", "STAFF"]);
    await assertGiftCardsPlan(tenantId);
    const parsed = giftCardRedeemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const giftCard = await redeemGiftCard({
      tenantId,
      giftCardId: params.id,
      amount: parsed.data.amount,
      note: parsed.data.note,
    });
    return NextResponse.json({ giftCard });
  } catch (e) {
    return apiError(e);
  }
}
