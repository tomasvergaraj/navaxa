import { NextResponse } from "next/server";
import { apiError, requireRole } from "@/lib/api-errors";
import { assertGiftCardsPlan } from "@/lib/plan-features";
import { findGiftCardByCode } from "@/lib/giftcards";

export const dynamic = "force-dynamic";

/** Busca una giftcard por código para canjearla en el mostrador (?code=NVX-XXXX). */
export async function GET(req: Request) {
  try {
    const { tenantId } = requireRole(["OWNER", "ADMIN", "STAFF"]);
    await assertGiftCardsPlan(tenantId);
    const code = new URL(req.url).searchParams.get("code") ?? "";
    if (code.trim().length < 4) {
      return NextResponse.json({ error: "Ingresa un código válido" }, { status: 400 });
    }
    const card = await findGiftCardByCode(tenantId, code);
    if (!card) return NextResponse.json({ error: "No existe una giftcard con ese código" }, { status: 404 });
    return NextResponse.json({ giftCard: card });
  } catch (e) {
    return apiError(e);
  }
}
