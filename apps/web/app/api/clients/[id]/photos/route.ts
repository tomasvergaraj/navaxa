import { NextResponse } from "next/server";
import { scopedDb, getTenantContext } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { assertWithinPlanLimit } from "@/lib/plan-limits";
import { storage } from "@/lib/storage";
import { compressImageWithThumb } from "@/lib/images";
import { haircutPhotoMetaSchema } from "@/lib/validators";
import { buildHaircutRatingUrl, sendHaircutRatingRequest } from "@/lib/haircut-rating";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantContext();
    const db = scopedDb();

    const exists = await db.client.findFirst({ where: { id: params.id } });
    if (!exists) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Máximo 8 MB" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se aceptan imágenes" }, { status: 400 });
    }

    const metaRaw = Object.fromEntries(form.entries());
    delete (metaRaw as any).file;
    const meta = haircutPhotoMetaSchema.safeParse(metaRaw);
    if (!meta.success) {
      return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });
    }

    // Si se asocia un barbero, debe ser del tenant (scopedDb inyecta tenantId).
    if (meta.data.barberId) {
      const barber = await db.barber.findFirst({
        where: { id: meta.data.barberId },
        select: { id: true },
      });
      if (!barber) return NextResponse.json({ error: "Barbero no encontrado" }, { status: 400 });
    }

    // Antes de subir: si ya está en el tope de fotos del plan, rechazar sin gastar storage.
    await assertWithinPlanLimit(tenantId, "photos");

    // Comprimir + thumbnail antes de subir (COSTS.md): el original puede pesar varios MB.
    const img = await compressImageWithThumb(Buffer.from(await file.arrayBuffer()));
    const prefix = `haircuts/${tenantId}/${params.id}`;
    const [main, thumb] = await Promise.all([
      storage.upload({ buffer: img.main, contentType: img.contentType, prefix, extension: img.extension }),
      storage.upload({
        buffer: img.thumb,
        contentType: img.contentType,
        prefix: `${prefix}/thumb`,
        extension: img.extension,
      }),
    ]);

    const record = await db.haircutRecord.create({
      data: {
        clientId: params.id,
        barberId: meta.data.barberId,
        imageUrl: main.url,
        thumbnailUrl: thumb.url,
        notes: meta.data.notes,
        style: meta.data.style,
      } as any,
    });

    // Link público de un solo toque para que el cliente deje su rating del corte.
    const ratingUrl = buildHaircutRatingUrl(record.id);

    // Fire-and-forget: si el plan permite WhatsApp y el cliente tiene canal,
    // el helper lo manda; si no, no rompe el upload. Errores quedan en NotificationLog.
    void sendHaircutRatingRequest(record.id, tenantId).catch(() => {});

    return NextResponse.json({ record, ratingUrl }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    const records = await db.haircutRecord.findMany({
      where: { clientId: params.id },
      orderBy: { performedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ records });
  } catch (e) {
    return apiError(e);
  }
}
