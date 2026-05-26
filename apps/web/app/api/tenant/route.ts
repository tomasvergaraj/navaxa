import { NextResponse } from "next/server";
import { prisma, DepositType } from "@navaxa/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { tenantUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// Tenant no lleva columna tenantId (su id ES el tenant) → se usa prisma directo, no scopedDb.
export async function PATCH(req: Request) {
  try {
    const { tenantId, role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const parsed = tenantUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const emptyToNull = (v?: string) => (v === undefined ? undefined : v === "" ? null : v);

    // Si es PERCENT, el valor es 0-100; si es FIXED, un monto en CLP.
    let depositValue = d.depositValue;
    if (depositValue !== undefined && d.depositType === "PERCENT") {
      depositValue = Math.min(100, depositValue);
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: d.name,
        rut: emptyToNull(d.rut),
        phone: emptyToNull(d.phone),
        email: emptyToNull(d.email),
        address: emptyToNull(d.address),
        city: emptyToNull(d.city),
        timezone: d.timezone,
        description: emptyToNull(d.description),
        instagram: emptyToNull(d.instagram),
        website: emptyToNull(d.website),
        bookingEnabled: d.bookingEnabled,
        bookingNoticeMin: d.bookingNoticeMin,
        paymentsEnabled: d.paymentsEnabled,
        depositType: d.depositType ? (d.depositType as DepositType) : undefined,
        depositValue,
      },
    });
    return NextResponse.json({ tenant });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
