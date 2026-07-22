import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@navaxa/ui";
import { chargeableAmount, loadPaymentByToken } from "@/lib/payments";
import { webpayFormUrl } from "@/lib/webpay";
import { signManageToken } from "@/lib/public-booking";
import { planHasGiftCards } from "@/lib/plan-features";
import { formatCLP } from "@/lib/format";
import { PaymentCheckout } from "./payment-checkout";
import { WebpayCheckout } from "./webpay-checkout";
import { GiftCardRedeem } from "./giftcard-redeem";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function PagarPage({ params }: { params: { token: string } }) {
  const payment = await loadPaymentByToken(params.token);

  if (!payment) {
    return (
      <Shell>
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-medium">Enlace de pago no válido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este enlace es inválido o ya no existe. Vuelve a reservar tu hora.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/">Ir a navaxa.cl</a>
        </Button>
      </Shell>
    );
  }

  const { tenant, appointment } = payment;
  const expired = payment.status === "PENDING" && payment.expiresAt < new Date();

  // Ya pagado → confirmación.
  if (payment.status === "PAID") {
    const manageToken = signManageToken(payment.appointmentId);
    return (
      <Shell>
        <CheckCircle2 className="h-10 w-10 text-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">Pago confirmado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu abono de <strong className="text-foreground">{formatCLP(payment.amount)}</strong> en{" "}
          {tenant.name} quedó registrado
          {payment.giftCardAmount > 0
            ? `, ${formatCLP(payment.giftCardAmount)} con la giftcard ${payment.giftCard?.code ?? ""}`.trimEnd()
            : ""}
          . ¡Te esperamos!
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href={`/reservar/gestion/${manageToken}`}>Ver mi reserva</Link>
        </Button>
      </Shell>
    );
  }

  // Cancelado / expirado / fallido.
  if (expired || payment.status !== "PENDING") {
    const failed = payment.status === "FAILED";
    return (
      <Shell>
        <Clock className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">
          {failed ? "El pago no se completó" : "El pago expiró"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {failed
            ? "El pago fue rechazado o cancelado, así que la reserva no quedó agendada y la hora se liberó. Puedes reservar de nuevo."
            : "El tiempo para pagar el abono se agotó y la hora se liberó. Puedes reservar de nuevo."}
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href={`/reservar/${tenant.slug}`}>Volver a reservar</Link>
        </Button>
      </Shell>
    );
  }

  // Pendiente → checkout.
  const fmtDateTime = new Intl.DateTimeFormat("es-CL", {
    timeZone: tenant.timezone ?? "America/Santiago",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const serviceNames = appointment.services.map((s) => s.service.name).join(" + ");
  const pending = chargeableAmount(payment);

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {tenant.name}
      </p>
      <h1 className="mt-1 font-display text-xl font-medium">Confirma tu reserva con un abono</h1>

      <div className="mt-5 space-y-1 rounded-lg bg-muted/50 p-4 text-sm">
        <p className="font-medium capitalize">{fmtDateTime.format(appointment.startsAt)}</p>
        <p className="text-muted-foreground">
          {serviceNames} · con {appointment.barber.user.name}
        </p>
        <p className="text-muted-foreground">Total servicio: {formatCLP(appointment.totalPrice)}</p>
      </div>

      {/* Con giftcard aplicada el abono se muestra desglosado: el saldo consumido
          no es un cobro nuevo (ese ingreso se reconoció al emitir la giftcard). */}
      {payment.giftCardAmount > 0 && (
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex items-baseline justify-between text-muted-foreground">
            <span>Abono</span>
            <span className="tabular-nums">{formatCLP(payment.amount)}</span>
          </div>
          <div className="flex items-baseline justify-between text-muted-foreground">
            <span>Giftcard {payment.giftCard?.code}</span>
            <span className="tabular-nums">−{formatCLP(payment.giftCardAmount)}</span>
          </div>
        </div>
      )}

      <div
        className={`mt-4 flex items-baseline justify-between pt-4 ${
          payment.giftCardAmount > 0 ? "" : "border-t border-border"
        }`}
      >
        <span className="text-sm text-muted-foreground">A pagar ahora</span>
        <span className="font-display text-2xl font-medium">{formatCLP(pending)}</span>
      </div>

      {/* Deadline: la hora se libera en silencio al expirar — hacerlo visible. */}
      <p className="mt-2 text-xs text-muted-foreground">
        Tienes hasta las{" "}
        <strong className="text-foreground">
          {new Intl.DateTimeFormat("es-CL", {
            timeZone: tenant.timezone ?? "America/Santiago",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(payment.expiresAt)}
        </strong>{" "}
        para pagar; si no, la hora se libera automáticamente.
      </p>

      {/* Antes de los botones de pago: si el saldo cubre todo, el cliente no
          llega a la pasarela. Solo en planes con giftcards y una por abono. */}
      {payment.giftCardAmount === 0 && planHasGiftCards(tenant.plan) && (
        <GiftCardRedeem token={params.token} />
      )}

      {payment.provider === "webpay" && payment.providerRef ? (
        <WebpayCheckout
          token={params.token}
          slug={tenant.slug}
          amountLabel={formatCLP(pending)}
          formAction={webpayFormUrl()}
          webpayToken={payment.providerRef}
        />
      ) : (
        <>
          <PaymentCheckout
            token={params.token}
            slug={tenant.slug}
            amountLabel={formatCLP(pending)}
          />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Pago de demostración (mock). No se cobra dinero real.
          </p>
        </>
      )}
    </Shell>
  );
}
