import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { campaignCreateSchema } from "@/lib/validators";
import { AUTOMATIONS } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireManager();
    const db = scopedDb();
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json({ campaigns });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Habilita una automatización del catálogo que el tenant aún no tiene (crea la
 * campaña con los defaults). No crea campañas arbitrarias: para envíos
 * puntuales está /api/campaigns/broadcast.
 */
export async function POST(req: Request) {
  try {
    const { tenantId } = requireManager();
    const parsed = campaignCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const def = AUTOMATIONS.find((a) => a.key === parsed.data.automationKey);
    if (!def) return NextResponse.json({ error: "Automatización desconocida" }, { status: 400 });

    const db = scopedDb();
    const existing = await db.campaign.findFirst({
      where: { trigger: def.trigger, templateKey: def.templateKey },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Esta automatización ya existe" }, { status: 409 });
    }

    const conditions = def.condition ? { [def.condition.field]: def.condition.default } : {};
    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: def.defaultName,
        description: def.description,
        trigger: def.trigger,
        channel: "EMAIL",
        templateKey: def.templateKey,
        active: false,
        conditions,
      },
    });
    return NextResponse.json({ campaign });
  } catch (e) {
    return apiError(e);
  }
}
