import { NextResponse } from "next/server";
import { scopedDb, TenantError } from "@/lib/tenant";
import { clientUpdateSchema, clientPreferenceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    const client = await db.client.findFirst({
      where: { id: params.id },
      include: {
        preferences: true,
        haircuts: {
          orderBy: { performedAt: "desc" },
          take: 30,
        },
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 10,
          include: {
            barber: { include: { user: true } },
            services: { include: { service: true } },
          },
        },
      },
    });
    if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ client });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = clientUpdateSchema.safeParse(body.client ?? body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = scopedDb();
    const exists = await db.client.findFirst({ where: { id: params.id } });
    if (!exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { birthDate, tags, ...rest } = parsed.data;
    const data = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => v !== "" && v !== undefined),
    );
    if (birthDate) (data as any).birthDate = new Date(birthDate);
    if (tags) (data as any).tags = tags;

    const updated = await db.client.update({
      where: { id: params.id },
      data: data as any,
    });

    // Update de preferencias si vienen
    if (body.preferences) {
      const pp = clientPreferenceSchema.safeParse(body.preferences);
      if (pp.success) {
        await db.clientPreference.upsert({
          where: { clientId: params.id },
          create: { clientId: params.id, ...pp.data },
          update: pp.data,
        });
      }
    }

    return NextResponse.json({ client: updated });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    await db.client.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
