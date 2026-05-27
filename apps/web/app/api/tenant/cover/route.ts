import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { requireManager, apiError } from "@/lib/api-errors";
import { storage } from "@/lib/storage";
import { compressImage } from "@/lib/images";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export async function POST(req: Request) {
  try {
    const { tenantId } = requireManager();

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

    // Portada: lado mayor un poco más amplio que el resto (banner horizontal).
    const img = await compressImage(Buffer.from(await file.arrayBuffer()), 2000);
    const { url } = await storage.upload({
      buffer: img.main,
      contentType: img.contentType,
      prefix: `covers/${tenantId}`,
      extension: img.extension,
    });

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { coverUrl: url },
      select: { coverUrl: true },
    });
    return NextResponse.json({ coverUrl: tenant.coverUrl });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE() {
  try {
    const { tenantId } = requireManager();
    await prisma.tenant.update({ where: { id: tenantId }, data: { coverUrl: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
