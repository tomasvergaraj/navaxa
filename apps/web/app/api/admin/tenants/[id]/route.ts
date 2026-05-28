import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Plan, SubscriptionStatus } from "@navaxa/db";
import { requireSuperAdmin } from "@/lib/platform";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    active: z.boolean().optional(),
    plan: z.nativeEnum(Plan).optional(),
    subscription: z
      .object({
        status: z.nativeEnum(SubscriptionStatus).optional(),
        currentPeriodEnd: z.string().datetime().nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (v) => v.active !== undefined || v.plan !== undefined || v.subscription !== undefined,
    "Sin cambios",
  );

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    requireSuperAdmin();
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const exists = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

    // Tenant: active + plan se mantienen en sync con Subscription.plan cuando se actualiza.
    const tenantData: Record<string, unknown> = {};
    if (parsed.data.active !== undefined) tenantData.active = parsed.data.active;
    if (parsed.data.plan !== undefined) tenantData.plan = parsed.data.plan;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(tenantData).length > 0) {
        await tx.tenant.update({ where: { id: params.id }, data: tenantData });
      }

      const subPatch: Record<string, unknown> = {};
      if (parsed.data.plan !== undefined) subPatch.plan = parsed.data.plan;
      if (parsed.data.subscription?.status !== undefined) subPatch.status = parsed.data.subscription.status;
      if (parsed.data.subscription?.currentPeriodEnd !== undefined) {
        subPatch.currentPeriodEnd = parsed.data.subscription.currentPeriodEnd
          ? new Date(parsed.data.subscription.currentPeriodEnd)
          : null;
      }
      if (Object.keys(subPatch).length > 0) {
        // upsert: si por algún motivo no existe Subscription, la creamos con valores razonables.
        await tx.subscription.upsert({
          where: { tenantId: params.id },
          update: subPatch,
          create: {
            tenantId: params.id,
            plan: (subPatch.plan as Plan) ?? Plan.FREE,
            status: (subPatch.status as SubscriptionStatus) ?? SubscriptionStatus.TRIALING,
            currentPeriodEnd: (subPatch.currentPeriodEnd as Date | null | undefined) ?? null,
            provider: "mock",
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
