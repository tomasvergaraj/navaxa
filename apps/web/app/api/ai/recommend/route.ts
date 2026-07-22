import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext, scopedDb } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { ownClientFilter } from "@/lib/page-guards";
import { recommendNextHaircut } from "@/lib/ai/recommendation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { prisma } from "@navaxa/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({ clientId: z.string().cuid() });

export async function POST(req: Request) {
  try {
    const { tenantId } = getTenantContext();

    // Rate limit anti cost-DoS: cada llamada gasta cuota de Anthropic. Tope por
    // tenant (30/hora) + por IP como respaldo. Antes no había ninguno.
    const rl = rateLimit(`ai:${tenantId}`, 30, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes de IA. Intenta más tarde." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }
    if (!rateLimit(`ai-ip:${clientIp(req)}`, 60, 60 * 60 * 1000).ok) {
      return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    }

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

    // Mismo alcance que la ficha: la recomendación resume el historial del
    // cliente, así que un barbero no la pide para uno que nunca atendió.
    const client = await scopedDb().client.findFirst({
      where: { id: parsed.data.clientId, ...(await ownClientFilter()) },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const rec = await recommendNextHaircut(client.id, tenantId);
    return NextResponse.json({ recommendation: rec });
  } catch (e) {
    return apiError(e);
  }
}
