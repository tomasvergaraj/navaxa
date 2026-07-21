import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { ApiError, apiError, requireManager } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { broadcastSchema } from "@/lib/validators";
import { countSegment, sendBroadcast } from "@/lib/notifications/broadcast";
import type { BroadcastSegment, BroadcastTemplateKey } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** El envío manual es feature del módulo de marketing (plan PRO+). */
async function assertProPlan(tenantId: string): Promise<"PRO" | "ENTERPRISE"> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (tenant?.plan !== "PRO" && tenant?.plan !== "ENTERPRISE") {
    throw new ApiError(403, "El envío manual de campañas es del plan Pro.");
  }
  return tenant.plan;
}

/** Vista previa: cuántos clientes recibiría el envío (?segment=&days=). */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireManager();
    await assertProPlan(tenantId);
    const { searchParams } = new URL(req.url);
    const segment = (searchParams.get("segment") ?? "all") as BroadcastSegment;
    const days = Number(searchParams.get("days") ?? 30);
    if (!["all", "inactive", "birthday_month"].includes(segment)) {
      return NextResponse.json({ error: "Segmento inválido" }, { status: 400 });
    }
    const count = await countSegment(tenantId, segment, Number.isFinite(days) ? days : 30);
    return NextResponse.json({ count });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireManager();
    const plan = await assertProPlan(tenantId);

    // Tope de envíos manuales por tenant: cada uno puede tocar cientos de
    // clientes; evita disparos accidentales repetidos (y gasto de cupo).
    const { ok, retryAfter } = rateLimit(`broadcast:${tenantId}`, 3, 60 * 60 * 1000);
    if (!ok) {
      return NextResponse.json(
        { error: `Demasiados envíos seguidos. Intenta en ${Math.ceil(retryAfter / 60)} min.` },
        { status: 429 },
      );
    }

    const parsed = broadcastSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { segment, days, templateKey, channel } = parsed.data;

    const result = await sendBroadcast({
      tenantId,
      plan,
      segment: segment as BroadcastSegment,
      days,
      templateKey: templateKey as BroadcastTemplateKey,
      preferWhatsApp: channel === "WHATSAPP",
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
