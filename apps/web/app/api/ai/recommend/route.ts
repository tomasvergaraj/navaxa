import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { recommendNextHaircut } from "@/lib/ai/recommendation";
import { prisma } from "@navaxa/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({ clientId: z.string().cuid() });

export async function POST(req: Request) {
  try {
    const { tenantId } = getTenantContext();
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
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
