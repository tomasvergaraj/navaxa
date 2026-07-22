import { NextResponse } from "next/server";
import { prisma } from "@navaxa/db";
import {
  appointmentChargeProvider,
  confirmAppointmentCharge,
  failAppointmentCharge,
  verifyAppointmentChargeToken,
} from "@/lib/appointment-charge-links";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Confirma el cobro del saldo del proveedor MOCK (botón «Pagar» del checkout
 * simulado en dev/sandbox). Con Webpay la confirmación llega EXCLUSIVAMENTE por
 * su return handler tras `commitWebpayTransaction`: si no se gatea acá,
 * cualquiera con el enlace daría por pagada una deuda sin pagar nada. Se
 * chequea el provider persistido Y el activo, para que un valor viejo en la fila
 * no reabra el hueco.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const limit = rateLimit(`apptcharge-confirm:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const chargeId = verifyAppointmentChargeToken(params.token);
    if (!chargeId) return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });

    const charge = await prisma.appointmentCharge.findUnique({
      where: { id: chargeId },
      select: { id: true, status: true, provider: true, expiresAt: true },
    });
    if (!charge) return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });

    if (charge.status === "PAID") return NextResponse.json({ ok: true });
    if (charge.status !== "PENDING") {
      return NextResponse.json({ error: "Este enlace ya no está vigente" }, { status: 409 });
    }

    if (charge.provider !== "mock" || appointmentChargeProvider() !== "mock") {
      return NextResponse.json({ error: "Este pago se confirma en la pasarela." }, { status: 409 });
    }

    if (charge.expiresAt < new Date()) {
      await failAppointmentCharge(charge.id, "EXPIRED");
      return NextResponse.json({ error: "El enlace de pago expiró." }, { status: 410 });
    }

    await confirmAppointmentCharge(charge.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
