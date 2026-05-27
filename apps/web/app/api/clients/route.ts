import { NextResponse } from "next/server";
import { scopedDb, getTenantContext } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { assertWithinPlanLimit } from "@/lib/plan-limits";
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
    return apiError(e);
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
    return apiError(e);
  }
}
