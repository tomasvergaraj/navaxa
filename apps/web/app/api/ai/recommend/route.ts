import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { recommendNextHaircut } from "@/lib/ai/recommendation";
import { prisma } from "@navaxa/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({ clientId: z.string().cuid() });

export async function POST(req: Request) {
  try {
    const { tenantId } = getTenantContext();

    // La recomendación con IA es feature de plan PRO/ENTERPRISE (COSTS.md §6).
    // Se chequea antes de la llamada a Anthropic para no generar costo en FREE/STARTER.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (tenant?.plan !== "PRO" && tenant?.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "La recomendación con IA está disponible desde el plan Pro." },
        { status: 403 },
      );
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, tenantId },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const rec = await recommendNextHaircut(client.id);
    return NextResponse.json({ recommendation: rec });
  } catch (e) {
    return apiError(e);
  }
}
