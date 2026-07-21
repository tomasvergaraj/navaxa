import { NextResponse } from "next/server";
import { prisma, type Prisma } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { campaignUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireManager();
    const parsed = campaignUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { active, channel, daysSinceLastVisit } = parsed.data;

    const db = scopedDb();
    const campaign = await db.campaign.findFirst({
      where: { id: params.id },
      select: { id: true, conditions: true, trigger: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

    // El umbral de inactividad solo aplica a la reactivación; se fusiona con el
    // resto de conditions para no perder otras claves.
    let conditions: Prisma.InputJsonValue | undefined;
    if (daysSinceLastVisit !== undefined && campaign.trigger === "RECALL_INACTIVE") {
      const prev = (campaign.conditions ?? {}) as Record<string, unknown>;
      conditions = { ...prev, daysSinceLastVisit };
    }

    const updated = await db.campaign.update({
      where: { id: campaign.id },
      data: {
        ...(active !== undefined ? { active } : {}),
        ...(channel !== undefined ? { channel } : {}),
        ...(conditions !== undefined ? { conditions } : {}),
      },
    });
    return NextResponse.json({ campaign: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireManager();
    const db = scopedDb();
    const campaign = await db.campaign.findFirst({
      where: { id: params.id },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
