import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { viewerScope } from "@/lib/page-guards";
import { deleteStoredObjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Borra una foto del historial visual, en BD y en storage.
 *
 * Hasta acá la galería solo crecía: las fotos son el único recurso que acumula
 * archivos (ver plan-limits), así que sin borrado el tenant se quedaba pegado
 * contra el tope de su plan sin forma de liberar.
 *
 * Alcance: gestión y recepción borran cualquier foto del local; un BARBER solo
 * las que él registró (mismo criterio de "solo lo suyo" que el resto).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  try {
    const { ownOnly, barberId } = await viewerScope();
    const db = scopedDb();

    const record = await db.haircutRecord.findFirst({
      where: {
        id: params.photoId,
        clientId: params.id,
        ...(ownOnly ? { barberId: barberId ?? "__none__" } : {}),
      },
      select: { id: true, imageUrl: true, imageKey: true, thumbnailUrl: true, thumbnailKey: true },
    });
    if (!record) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

    await db.haircutRecord.delete({ where: { id: record.id } });
    await deleteStoredObjects([
      { key: record.imageKey, url: record.imageUrl },
      { key: record.thumbnailKey, url: record.thumbnailUrl },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
