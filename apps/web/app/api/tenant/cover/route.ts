import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { requireManager, apiError } from "@/lib/api-errors";
import { storage, deleteStoredObject } from "@/lib/storage";
import { compressImage } from "@/lib/images";
import { guardUploadSize } from "@/lib/upload";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireManager();
    guardUploadSize(req, MAX_BYTES);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Máximo 6 MB" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se aceptan imágenes" }, { status: 400 });
    }

    const previous = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { coverUrl: true, coverKey: true },
    });

    // Portada: lado mayor un poco más amplio que el resto (banner horizontal).
    const img = await compressImage(Buffer.from(await file.arrayBuffer()), 2000);
    const { key, url } = await storage.upload({
      buffer: img.main,
      contentType: img.contentType,
      prefix: `covers/${tenantId}`,
      extension: img.extension,
    });

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { coverUrl: url, coverKey: key },
      select: { coverUrl: true },
    });
    // Recién con la fila apuntando al nuevo objeto borramos el viejo.
    await deleteStoredObject({ key: previous?.coverKey, url: previous?.coverUrl });
    return NextResponse.json({ coverUrl: tenant.coverUrl });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE() {
  try {
    const { tenantId } = await requireManager();
    // Leer antes de limpiar: `update` devuelve la fila ya actualizada.
    const previous = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { coverUrl: true, coverKey: true },
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { coverUrl: null, coverKey: null },
    });
    await deleteStoredObject({ key: previous?.coverKey, url: previous?.coverUrl });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
