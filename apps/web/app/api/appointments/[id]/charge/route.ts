import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireRole } from "@/lib/api-errors";
import { appointmentChargeSchema } from "@/lib/validators";
import { chargeAppointmentBalance } from "@/lib/appointment-charges";
import { computeAppointmentBalance } from "@/lib/appointment-balance";

export const dynamic = "force-dynamic";

// Mismos roles que la caja: recepción (STAFF) también cobra, BARBER no.
const CASHIER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;

// Sin gate de plan a propósito: un tenant FREE con abonos activados quedaría
// sin ninguna forma de cobrar el saldo si esto exigiera plan de productos.

/** Saldo pendiente de la cita + los cobros ya hechos. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CASHIER_ROLES);
    const appt = await scopedDb().appointment.findFirst({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        payment: { select: { amount: true, status: true } },
        sales: {
          where: { cancelledAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, total: true, paymentMethod: true, kind: true, createdAt: true },
        },
      },
    });
    if (!appt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const balance = computeAppointmentBalance({
      totalPrice: appt.totalPrice,
      payment: appt.payment,
      sales: appt.sales,
    });
    return NextResponse.json({ ...balance, status: appt.status, sales: appt.sales });
  } catch (e) {
    return apiError(e);
  }
}

/** Registra un cobro del saldo (efectivo, tarjeta/POS, transferencia u otro). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await requireRole(CASHIER_ROLES);
    const parsed = appointmentChargeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await chargeAppointmentBalance({
      tenantId,
      appointmentId: params.id,
      ...parsed.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
