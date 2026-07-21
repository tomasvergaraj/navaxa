import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { viewerScope } from "@/lib/page-guards";
import { clientUpdateSchema, clientPreferenceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * Filtro de "cliente propio" para el BARBER: solo los que atendió alguna vez.
 * Misma definición que el listado (api/clients/route.ts) — si no, el listado le
 * muestra 3 clientes pero adivinando el id entraba a la ficha de cualquiera.
 * Gestión (OWNER/ADMIN) y recepción (STAFF) no se filtran.
 */
async function ownClientFilter(): Promise<Record<string, unknown>> {
  const { ownOnly, barberId } = await viewerScope();
  return ownOnly ? { appointments: { some: { barberId: barberId ?? "__none__" } } } : {};
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    const client = await db.client.findFirst({
      where: { id: params.id, ...(await ownClientFilter()) },
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
    return apiError(e);
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
    // Mismo alcance que el GET: un barbero no edita la ficha de un cliente que
    // nunca atendió (el update de abajo ya va por id, así que el chequeo es acá).
    const exists = await db.client.findFirst({
      where: { id: params.id, ...(await ownClientFilter()) },
    });
    if (!exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { birthDate, tags, ...rest } = parsed.data;
    // Solo descartamos `undefined` (= no enviado). String vacío y array vacío
    // son intencionales: el usuario quiso vaciar el campo.
    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => v !== undefined),
    );
    if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;
    if (tags !== undefined) data.tags = tags;

    const updated = await db.client.update({
      where: { id: params.id },
      data: data as any,
    });

    // Update de preferencias si vienen. null en un campo = limpiar; undefined = no tocar.
    if (body.preferences) {
      const pp = clientPreferenceSchema.safeParse(body.preferences);
      if (pp.success) {
        const updateData = Object.fromEntries(
          Object.entries(pp.data).filter(([_, v]) => v !== undefined),
        );
        // En create, los null son válidos (todas las columnas son nullable).
        await db.clientPreference.upsert({
          where: { clientId: params.id },
          create: { clientId: params.id, ...updateData },
          update: updateData,
        });
      }
    }

    return NextResponse.json({ client: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireManager(); // Borrar clientes es acción de gestión; un barbero no puede.
    const db = scopedDb();
    await db.client.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
