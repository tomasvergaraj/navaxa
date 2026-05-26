import { NextResponse } from "next/server";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";
import { storage } from "@/lib/storage";
import { haircutPhotoMetaSchema } from "@/lib/validators";

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1]?.split("+")[0] ?? "jpg";
    const { url } = await storage.upload({
      buffer,
      contentType: file.type,
      prefix: `haircuts/${tenantId}/${params.id}`,
      extension: ext,
    });

    const record = await db.haircutRecord.create({
      data: {
        clientId: params.id,
        barberId: meta.data.barberId,
        imageUrl: url,
        notes: meta.data.notes,
        style: meta.data.style,
        rating: meta.data.rating,
      } as any,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = scopedDb();
    const records = await db.haircutRecord.findMany({
      where: { clientId: params.id },
      orderBy: { performedAt: "desc" },
    });
    return NextResponse.json({ records });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
