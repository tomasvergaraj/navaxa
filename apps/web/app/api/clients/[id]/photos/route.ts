import { NextResponse } from "next/server";
import { scopedDb, getTenantContext } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { assertWithinPlanLimit } from "@/lib/plan-limits";
import { storage } from "@/lib/storage";
import { compressImageWithThumb } from "@/lib/images";
import { haircutPhotoMetaSchema } from "@/lib/validators";
import { buildHaircutRatingUrl } from "@/lib/haircut-rating";
import { buildReviewUrl } from "@/lib/reviews";
import { guardUploadSize } from "@/lib/upload";
import { subHours, addHours } from "date-fns";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    guardUploadSize(req, MAX_BYTES);
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

    // Vincular la foto a la cita del cliente en curso/reciente: así la
    // invitación a reseñar (una sola por visita, sale al completar la cita)
    // muestra la foto y el rating del cliente aplica también al corte.
    const now = new Date();
    const appt = await db.appointment.findFirst({
      where: {
        clientId: params.id,
        ...(meta.data.barberId ? { barberId: meta.data.barberId } : {}),
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startsAt: { gte: subHours(now, 24), lte: addHours(now, 1) },
      },
      orderBy: { startsAt: "desc" },
      select: { id: true },
    });
    const apptTaken = appt
      ? await db.haircutRecord.findFirst({ where: { appointmentId: appt.id }, select: { id: true } })
      : null;
    const appointmentId = appt && !apptTaken ? appt.id : null;

    const record = await db.haircutRecord.create({
      data: {
        clientId: params.id,
        barberId: meta.data.barberId,
        appointmentId,
        imageUrl: main.url,
        thumbnailUrl: thumb.url,
        notes: meta.data.notes,
        style: meta.data.style,
      } as any,
    });

    // Link para compartir a mano (copiar/WhatsApp en el diálogo de subida).
    // Si la foto quedó ligada a una cita va al flujo unificado de reseña;
    // si no, al rating simple del corte. Ya no se manda notificación acá:
    // la única invitación por visita sale al completar la cita.
    const ratingUrl = appointmentId ? buildReviewUrl(appointmentId) : buildHaircutRatingUrl(record.id);

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
