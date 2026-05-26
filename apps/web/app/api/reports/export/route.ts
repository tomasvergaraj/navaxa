import { NextResponse } from "next/server";
import { format } from "date-fns";
import { scopedDb, getTenantContext, TenantError } from "@/lib/tenant";
import { parsePeriod } from "@/lib/reports";
import { APPOINTMENT_STATUS_LABELS } from "@navaxa/config";

export const dynamic = "force-dynamic";

const DELIM = ";";
function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(DELIM);
}

export async function GET(req: Request) {
  try {
    const { role } = getTenantContext();
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = parsePeriod({
      range: searchParams.get("range") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    const db = scopedDb();
    const appts = await db.appointment.findMany({
      where: { startsAt: { gte: period.from, lte: period.to } },
      orderBy: { startsAt: "asc" },
      select: {
        startsAt: true,
        totalPrice: true,
        status: true,
        client: { select: { firstName: true, lastName: true, phone: true } },
        barber: { select: { user: { select: { name: true } } } },
        services: { select: { service: { select: { name: true } } } },
      },
    });

    const header = ["Fecha", "Hora", "Cliente", "Teléfono", "Barbero", "Servicios", "Total", "Estado"];
    const rows = appts.map((a) =>
      csvRow([
        format(a.startsAt, "yyyy-MM-dd"),
        format(a.startsAt, "HH:mm"),
        `${a.client.firstName} ${a.client.lastName ?? ""}`.trim(),
        a.client.phone ?? "",
        a.barber.user.name,
        a.services.map((s) => s.service.name).join(", "),
        a.totalPrice,
        APPOINTMENT_STATUS_LABELS[a.status] ?? a.status,
      ]),
    );

    // BOM para que Excel (es-CL) respete los acentos.
    const csv = "﻿" + [csvRow(header), ...rows].join("\n");
    const filename = `reporte_${format(period.from, "yyyyMMdd")}_${format(period.to, "yyyyMMdd")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
