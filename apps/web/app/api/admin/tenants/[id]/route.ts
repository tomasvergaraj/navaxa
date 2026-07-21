import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Plan, SubscriptionStatus } from "@navaxa/db";
import { requireSuperAdmin } from "@/lib/platform";
import { logAdminAction } from "@/lib/audit";
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
    const actor = await requireSuperAdmin();
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Estado previo completo de lo auditable: se registra junto al cambio para
    // que el log diga qué se tocó, no solo qué se pidió.
    const exists = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        active: true,
        plan: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
    });
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

    // Solo los campos que el PATCH tocó, en su valor de antes y de después.
    const touched = {
      ...(parsed.data.active !== undefined
        ? { active: { before: exists.active, after: parsed.data.active } }
        : {}),
      ...(parsed.data.plan !== undefined
        ? { plan: { before: exists.plan, after: parsed.data.plan } }
        : {}),
      ...(parsed.data.subscription?.status !== undefined
        ? {
            status: {
              before: exists.subscription?.status ?? null,
              after: parsed.data.subscription.status,
            },
          }
        : {}),
      ...(parsed.data.subscription?.currentPeriodEnd !== undefined
        ? {
            currentPeriodEnd: {
              before: exists.subscription?.currentPeriodEnd?.toISOString() ?? null,
              after: parsed.data.subscription.currentPeriodEnd,
            },
          }
        : {}),
    };

    await logAdminAction({
      actor,
      action: "tenant.update",
      targetType: "Tenant",
      targetId: params.id,
      before: Object.fromEntries(Object.entries(touched).map(([k, v]) => [k, v.before])),
      after: Object.fromEntries(Object.entries(touched).map(([k, v]) => [k, v.after])),
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
