import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { scopedDb, getTenantContext } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";
import { storage } from "@/lib/storage";
import { compressImage } from "@/lib/images";
import { guardUploadSize } from "@/lib/upload";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

// El dueño/admin puede gestionar cualquier avatar; un barbero puede gestionar el suyo.
async function authorize(barberId: string) {
  const ctx = getTenantContext();
  const db = scopedDb();
  const barber = await db.barber.findFirst({ where: { id: barberId }, select: { id: true, userId: true } });
  if (!barber) return { error: "Barbero no encontrado", status: 404 as const };
  const allowed = ctx.role === "OWNER" || ctx.role === "ADMIN" || barber.userId === ctx.userId;
  if (!allowed) return { error: "Sin permiso", status: 403 as const };
  return { barber, tenantId: ctx.tenantId };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    guardUploadSize(req, MAX_BYTES);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Máximo 4 MB" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se aceptan imágenes" }, { status: 400 });
    }

    const img = await compressImage(Buffer.from(await file.arrayBuffer()), 600);
    const { url } = await storage.upload({
      buffer: img.main,
      contentType: img.contentType,
      prefix: `avatars/${auth.tenantId}/${params.id}`,
      extension: img.extension,
    });

    const barber = await prisma.barber.update({
      where: { id: params.id },
      data: { avatarUrl: url },
      select: { avatarUrl: true },
    });
    return NextResponse.json({ avatarUrl: barber.avatarUrl });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    await prisma.barber.update({ where: { id: params.id }, data: { avatarUrl: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
