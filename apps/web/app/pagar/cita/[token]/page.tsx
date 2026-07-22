import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@navaxa/ui";
import {
  loadAppointmentChargeByToken,
  refreshWebpayTransaction,
} from "@/lib/appointment-charge-links";
import { computeAppointmentBalance, isChargeableStatus } from "@/lib/appointment-balance";
import { signManageToken } from "@/lib/public-booking";
import { webpayFormUrl } from "@/lib/webpay";
import { formatCLP } from "@/lib/format";
import { AppointmentChargeCheckout } from "./appointment-charge-checkout";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pagar el saldo de tu cita", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function PagarCitaPage({ params }: { params: { token: string } }) {
  const charge = await loadAppointmentChargeByToken(params.token);

  if (!charge) {
    return (
      <Shell>
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-medium">Enlace no válido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este enlace de pago es inválido o ya no existe. Pídele uno nuevo a la barbería.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/">Ir a navaxa.cl</a>
        </Button>
      </Shell>
    );
  }

  const { tenant, appointment } = charge;

  // Pagado → confirmación. El link a la gestión de la reserva le deja al cliente
  // el detalle completo de su cita.
  if (charge.status === "PAID") {
    const manageToken = signManageToken(appointment.id);
    return (
      <Shell>
        <CheckCircle2 className="h-10 w-10 text-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">Pago recibido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pagaste <strong className="text-foreground">{formatCLP(charge.amount)}</strong> del saldo
          de tu cita en {tenant.name}. ¡Gracias!
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href={`/reservar/gestion/${manageToken}`}>Ver mi reserva</Link>
        </Button>
      </Shell>
    );
  }

  // El enlace vive 24 h: en el medio la cita pudo cancelarse o el saldo pudo
  // cobrarse en el local. Revalidar acá evita el sobrepago, que después no se
  // puede deshacer (la pasarela ya movió la plata).
  const { balance } = computeAppointmentBalance({
    totalPrice: appointment.totalPrice,
    payment: appointment.payment,
    sales: appointment.sales,
  });
  const stale =
    !isChargeableStatus(appointment.status) || balance <= 0 || charge.amount > balance;

  const expired = charge.status === "PENDING" && charge.expiresAt < new Date();

  if (expired || stale || charge.status !== "PENDING") {
    const failed = charge.status === "FAILED";
    return (
      <Shell>
        <Clock className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">
          {failed ? "El pago no se completó" : "Este enlace ya no está vigente"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {failed
            ? "El pago fue rechazado o cancelado, así que no se te cobró nada."
            : "El enlace venció o el saldo ya se pagó de otra forma."}{" "}
          Si todavía tienes saldo pendiente, pídele un enlace nuevo a {tenant.name}.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href={`/reservar/${tenant.slug}`}>Ir a {tenant.name}</Link>
        </Button>
      </Shell>
    );
  }

  // Pendiente → checkout. La transacción de Webpay se pide acá (no al generar el
  // enlace): su token es efímero y el enlace vive 24 h.
  const webpayToken = await refreshWebpayTransaction(charge);

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
      <h1 className="mt-1 font-display text-xl font-medium">Paga el saldo de tu cita</h1>

      <div className="mt-5 space-y-1 rounded-lg bg-muted/50 p-4 text-sm">
        <p className="font-medium capitalize">{fmtDateTime.format(appointment.startsAt)}</p>
        <p className="text-muted-foreground">
          {serviceNames} · con {appointment.barber.user.name}
        </p>
        <p className="text-muted-foreground">
          Total servicio: {formatCLP(appointment.totalPrice)}
        </p>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">A pagar ahora</span>
        <span className="font-display text-2xl font-medium">{formatCLP(charge.amount)}</span>
      </div>

      <AppointmentChargeCheckout
        token={params.token}
        amountLabel={formatCLP(charge.amount)}
        webpay={webpayToken ? { formAction: webpayFormUrl(), webpayToken } : null}
      />
    </Shell>
  );
}
