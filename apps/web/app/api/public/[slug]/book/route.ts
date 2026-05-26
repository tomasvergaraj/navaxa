import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { prisma } from "@navaxa/db";
import { publicBookSchema } from "@/lib/validators";
import { createAppointment } from "@/lib/booking";
import {
  resolveTenantBySlug,
  resolveServices,
  activeBarberIds,
  getAvailabilityForBarbers,
  signManageToken,
} from "@/lib/public-booking";
import { notifyAppointment } from "@/lib/appointment-notify";
import { assertWithinPlanLimit, PlanLimitError } from "@/lib/plan-limits";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  computeDeposit,
  getPaymentProvider,
  signPaymentToken,
  PAYMENT_TTL_MIN,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const limit = rateLimit(`book:${params.slug}:${clientIp(req)}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });

  const parsed = publicBookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { barberId, startsAt, serviceIds, notes, client } = parsed.data;
  const start = new Date(startsAt);

  // Anticipación mínima + no permitir pasado.
  const minStart = addMinutes(new Date(), tenant.bookingNoticeMin);
  if (start < minStart) {
    return NextResponse.json({ error: "El horario ya no está disponible" }, { status: 409 });
  }

  const services = await resolveServices(tenant.id, serviceIds);
  if (!services) return NextResponse.json({ error: "Servicios inválidos" }, { status: 400 });
  const durationMin = services.reduce((s, x) => s + x.durationMin, 0);
  const total = services.reduce((s, x) => s + x.price, 0);

  // Abono a cobrar (0 = sin cobro → flujo de confirmación directa).
  const depositAmount = tenant.paymentsEnabled
    ? computeDeposit(total, tenant.depositType, tenant.depositValue)
    : 0;

  // Resolver barbero (si es "cualquiera", elegir uno libre en ese horario).
  let resolvedBarberId: string;
  if (barberId === "any") {
    const ids = await activeBarberIds(tenant.id);
    const slots = await getAvailabilityForBarbers(ids, start, durationMin);
    const match = slots.find((s) => +s.startsAt === +start);
    if (!match) {
      return NextResponse.json({ error: "El horario ya no está disponible" }, { status: 409 });
    }
    resolvedBarberId = match.barberId;
  } else {
    const ids = await activeBarberIds(tenant.id);
    if (!ids.includes(barberId)) {
      return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
    }
    resolvedBarberId = barberId;
  }

  // Crear o reutilizar cliente por teléfono dentro del tenant.
  const phone = client.phone.trim();
  const existing = await prisma.client.findFirst({
    where: { tenantId: tenant.id, phone },
    select: { id: true, lastName: true, email: true },
  });

  let clientId: string;
  let createdNewClient = false;
  if (existing) {
    clientId = existing.id;
    // Completar datos faltantes sin sobreescribir lo ya cargado.
    const patch: { lastName?: string; email?: string } = {};
    if (!existing.lastName && client.lastName) patch.lastName = client.lastName;
    if (!existing.email && client.email) patch.email = client.email;
    if (Object.keys(patch).length) {
      await prisma.client.update({ where: { id: clientId }, data: patch });
    }
  } else {
    // Cliente nuevo: respeta el tope de clientes del plan. Mensaje neutro al
    // cliente final (no se le expone el límite interno de la barbería).
    try {
      await assertWithinPlanLimit(tenant.id, "clients");
    } catch (e) {
      if (e instanceof PlanLimitError) {
        return NextResponse.json(
          {
            error:
              "La barbería no puede tomar nuevas reservas en este momento. Escríbele directamente para agendar.",
          },
          { status: 409 },
        );
      }
      throw e;
    }
    const created = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: client.firstName,
        lastName: client.lastName || null,
        phone,
        email: client.email || null,
        source: "booking",
      },
      select: { id: true },
    });
    clientId = created.id;
    createdNewClient = true;
  }

  // Crear la cita (valida solape dentro de transacción). Con abono queda
  // PENDING_PAYMENT y se crea el Payment en la misma tx.
  let appt;
  try {
    appt = await createAppointment({
      tenantId: tenant.id,
      clientId,
      barberId: resolvedBarberId,
      startsAt: start,
      serviceIds,
      source: "booking",
      notes,
      deposit:
        depositAmount > 0
          ? {
              amount: depositAmount,
              provider: getPaymentProvider().name,
              expiresAt: addMinutes(new Date(), PAYMENT_TTL_MIN),
            }
          : undefined,
    });
  } catch (e) {
    // Si recién creamos el cliente para esta reserva fallida, no dejarlo huérfano.
    if (createdNewClient) {
      await prisma.client.delete({ where: { id: clientId } }).catch(() => undefined);
    }
    const msg = (e as Error).message;
    const status = msg.includes("ocupado") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // --- Flujo con abono: redirigir a la pasarela; aún NO se confirma. ---
  const payment = appt.payment;
  if (payment) {
    const token = signPaymentToken(payment.id);
    try {
      const { providerRef, checkoutUrl } = await getPaymentProvider().createCheckout({
        paymentId: payment.id,
        token,
        amount: payment.amount,
        currency: payment.currency,
        description: `Abono reserva ${tenant.name}`,
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerRef },
      });
      return NextResponse.json(
        {
          appointmentId: appt.id,
          requiresPayment: true,
          checkoutUrl,
          paymentToken: token,
          depositAmount: payment.amount,
          totalPrice: appt.totalPrice,
        },
        { status: 201 },
      );
    } catch {
      // No se pudo iniciar el cobro: liberar la hora.
      await prisma.appointment
        .update({ where: { id: appt.id }, data: { status: "CANCELLED" } })
        .catch(() => undefined);
      await prisma.payment
        .update({ where: { id: payment.id }, data: { status: "FAILED" } })
        .catch(() => undefined);
      return NextResponse.json(
        { error: "No se pudo iniciar el pago. Intenta de nuevo." },
        { status: 502 },
      );
    }
  }

  // --- Flujo sin abono: confirmar de inmediato (comportamiento original). ---
  await notifyAppointment("confirmed", tenant, appt).catch(() => undefined);

  const manageToken = signManageToken(appt.id);
  return NextResponse.json(
    {
      appointmentId: appt.id,
      manageToken,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
      totalPrice: appt.totalPrice,
      barberName: appt.barber.user.name,
    },
    { status: 201 },
  );
}
