import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { requireManager, apiError } from "@/lib/api-errors";
import { storage } from "@/lib/storage";
import { compressImage } from "@/lib/images";
import { guardUploadSize } from "@/lib/upload";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

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
      return NextResponse.json({ error: "Máximo 4 MB" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se aceptan imágenes" }, { status: 400 });
    }

    const img = await compressImage(Buffer.from(await file.arrayBuffer()));
    const { url } = await storage.upload({
      buffer: img.main,
      contentType: img.contentType,
      prefix: `logos/${tenantId}`,
      extension: img.extension,
    });

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: url },
      select: { logoUrl: true },
    });
    return NextResponse.json({ logoUrl: tenant.logoUrl });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE() {
  try {
    const { tenantId } = await requireManager();
    await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
