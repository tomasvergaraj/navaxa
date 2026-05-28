import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@navaxa/ui";
import { loadPaymentByToken } from "@/lib/payments";
import { webpayFormUrl } from "@/lib/webpay";
import { signManageToken } from "@/lib/public-booking";
import { formatCLP } from "@/lib/format";
import { PaymentCheckout } from "./payment-checkout";
import { WebpayCheckout } from "./webpay-checkout";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
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
        <CheckCircle2 className="h-10 w-10 text-accent-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">Pago confirmado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu abono de <strong className="text-foreground">{formatCLP(payment.amount)}</strong> en{" "}
          {tenant.name} quedó registrado. ¡Te esperamos!
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href={`/reservar/gestion/${manageToken}`}>Ver mi reserva</Link>
        </Button>
      </Shell>
    );
  }

  // Cancelado / expirado / fallido.
  if (expired || payment.status !== "PENDING") {
    return (
      <Shell>
        <Clock className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">El pago expiró</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El tiempo para pagar el abono se agotó y la hora se liberó. Puedes reservar de nuevo.
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

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Abono a pagar ahora</span>
        <span className="font-display text-2xl font-medium">{formatCLP(payment.amount)}</span>
      </div>

      {payment.provider === "webpay" && payment.providerRef ? (
        <WebpayCheckout
          token={params.token}
          slug={tenant.slug}
          amountLabel={formatCLP(payment.amount)}
          formAction={webpayFormUrl()}
          webpayToken={payment.providerRef}
        />
      ) : (
        <>
          <PaymentCheckout
            token={params.token}
            slug={tenant.slug}
            amountLabel={formatCLP(payment.amount)}
          />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Pago de demostración (mock). No se cobra dinero real.
          </p>
        </>
      )}
    </Shell>
  );
}
