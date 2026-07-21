import { NextResponse } from "next/server";
import { addMonths } from "date-fns";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { assertGiftCardsPlan } from "@/lib/plan-features";
import { giftCardIssueSchema } from "@/lib/validators";
import { issueGiftCard } from "@/lib/giftcards";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { tenantId } = await requireManager();
    await assertGiftCardsPlan(tenantId);
    const db = scopedDb();
    const giftCards = await db.giftCard.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json({ giftCards });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireManager();
    await assertGiftCardsPlan(tenantId);
    const parsed = giftCardIssueSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const months = d.expiresInMonths ?? 12;
    const giftCard = await issueGiftCard({
      tenantId,
      amount: d.amount,
      buyerName: d.buyerName,
      recipientName: d.recipientName,
      recipientEmail: d.recipientEmail || undefined,
      message: d.message,
      expiresAt: months > 0 ? addMonths(new Date(), months) : null,
    });

    // Email al destinatario con el código (best-effort; no rompe la emisión).
    if (giftCard.recipientEmail) {
      const db = scopedDb();
      const tenant = await db.tenant.findFirst({ select: { name: true } }).catch(() => null);
      void sendNotification({
        tenantId,
        channel: "EMAIL",
        recipient: giftCard.recipientEmail,
        templateKey: "giftcard_issued",
        data: {
          recipientName: giftCard.recipientName ?? "",
          shopName: tenant?.name ?? "la barbería",
          amount: giftCard.initialValue,
          code: giftCard.code,
          message: giftCard.message ?? "",
        },
      }).catch(() => {});
    }

    return NextResponse.json({ giftCard }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
