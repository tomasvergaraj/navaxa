import { NextResponse } from "next/server";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";
import { assertWithinPlanLimit, PlanLimitError } from "@/lib/plan-limits";
import { clientCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const db = scopedDb();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const take = Math.min(Number(searchParams.get("take") ?? 50), 100);
    const skip = Math.max(0, Number(searchParams.get("skip") ?? 0));

    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } },
        take,
        skip,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          avatarUrl: true,
          lastVisitAt: true,
          totalVisits: true,
          totalSpent: true,
          tags: true,
        },
      }),
      db.client.count({ where }),
    ]);

    return NextResponse.json({ clients, total });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const parsed = clientCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { tenantId } = getTenantContext();
    await assertWithinPlanLimit(tenantId, "clients");
    const db = scopedDb();
    const { tags, birthDate, ...rest } = parsed.data;
    const cleaned = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => v !== "" && v !== undefined),
    );
    const client = await db.client.create({
      data: {
        ...(cleaned as any),
        tags: tags ?? [],
        birthDate: birthDate ? new Date(birthDate) : null,
      },
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof PlanLimitError)
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
