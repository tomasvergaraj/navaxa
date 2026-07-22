import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { apiError, requireRole } from "@/lib/api-errors";
import { appointmentChargeLinkSchema } from "@/lib/validators";
import {
  cancelAppointmentChargeLink,
  createAppointmentChargeLink,
  type ChargeLinkSummary,
} from "@/lib/appointment-charge-links";

export const dynamic = "force-dynamic";

// Mismos roles que el cobro manual y la caja; BARBER no cobra.
const CASHIER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;

// Sin gate de plan, por el mismo motivo que el cobro manual: un tenant FREE con
// abonos activados quedaría sin forma de cobrar el saldo.

/**
 * El QR se genera en el server y viaja como data URL. Así la librería `qrcode`
 * no entra al bundle del cliente por un diálogo que se abre de vez en cuando.
 */
async function withQr(link: ChargeLinkSummary) {
  const qr = await QRCode.toDataURL(link.url, { width: 480, margin: 1 });
  return { url: link.url, amount: link.amount, expiresAt: link.expiresAt, qr };
}

/** Emite (o reusa) el link de cobro del saldo. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireRole(CASHIER_ROLES);
    const parsed = appointmentChargeLinkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const link = await createAppointmentChargeLink({
      tenantId,
      appointmentId: params.id,
      amount: parsed.data.amount,
    });
    return NextResponse.json(await withQr(link), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

/** Anula el link vigente (el cliente terminó pagando en el local, p. ej.). */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireRole(CASHIER_ROLES);
    const cancelled = await cancelAppointmentChargeLink(tenantId, params.id);
    return NextResponse.json({ cancelled });
  } catch (e) {
    return apiError(e);
  }
}
