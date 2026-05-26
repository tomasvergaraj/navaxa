import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(req: Request) {
  try {
    const { tenantId, role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1]?.split("+")[0] ?? "png";
    const { url } = await storage.upload({
      buffer,
      contentType: file.type,
      prefix: `logos/${tenantId}`,
      extension: ext,
    });

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: url },
      select: { logoUrl: true },
    });
    return NextResponse.json({ logoUrl: tenant.logoUrl });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { tenantId, role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
