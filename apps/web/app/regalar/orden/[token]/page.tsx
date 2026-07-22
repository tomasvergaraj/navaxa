import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Gift } from "lucide-react";
import { Button } from "@navaxa/ui";
import { loadGiftCardOrderByToken } from "@/lib/giftcard-orders";
import { webpayFormUrl } from "@/lib/webpay";
import { formatCLP, tzFormatters } from "@/lib/format";
import { GiftOrderCheckout } from "./gift-order-checkout";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu giftcard", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function OrdenGiftcardPage({ params }: { params: { token: string } }) {
  const order = await loadGiftCardOrderByToken(params.token);

  if (!order) {
    return (
      <Shell>
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-medium">Enlace no válido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este enlace es inválido o ya no existe.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/">Ir a navaxa.cl</a>
        </Button>
      </Shell>
    );
  }

  const { tenant } = order;

  // Pagada: el código es lo único que importa en esta pantalla.
  if (order.status === "PAID" && order.giftCard) {
    return (
      <Shell>
        <CheckCircle2 className="h-10 w-10 text-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">¡Giftcard lista!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Compraste una giftcard de{" "}
          <strong className="text-foreground">{formatCLP(order.amount)}</strong> en {tenant.name}.
          {order.recipientEmail
            ? ` Le enviamos el código a ${order.recipientEmail}.`
            : ` Te enviamos el código a ${order.buyerEmail}.`}
        </p>
        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Código</p>
          <p className="mt-1 font-display text-2xl font-medium tracking-widest">
            {order.giftCard.code}
          </p>
          {order.giftCard.expiresAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Válida hasta el{" "}
              {tzFormatters(tenant.timezone ?? "America/Santiago").dayLong.format(
                order.giftCard.expiresAt,
              )}
            </p>
          )}
        </div>
        <Button asChild className="mt-6 w-full">
          <Link href={`/reservar/${tenant.slug}`}>Reservar en {tenant.name}</Link>
        </Button>
      </Shell>
    );
  }

  const expired = order.status === "PENDING" && order.expiresAt < new Date();

  if (expired || order.status !== "PENDING") {
    const failed = order.status === "FAILED";
    return (
      <Shell>
        <Clock className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-medium">
          {failed ? "El pago no se completó" : "La compra expiró"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {failed
            ? "El pago fue rechazado o cancelado, así que no se emitió ninguna giftcard y no se te cobró nada."
            : "Pasó el tiempo para pagar y no se emitió ninguna giftcard."}{" "}
          Puedes empezar de nuevo.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href={`/regalar/${tenant.slug}`}>Comprar otra vez</Link>
        </Button>
      </Shell>
    );
  }

  // Pendiente de pago.
  const deadline = tzFormatters(tenant.timezone ?? "America/Santiago").time.format(order.expiresAt);

  return (
    <Shell>
      <Gift className="h-10 w-10 text-primary" />
      <h1 className="mt-4 font-display text-xl font-medium">Confirma tu giftcard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Giftcard de <strong className="text-foreground">{formatCLP(order.amount)}</strong> para{" "}
        {tenant.name}
        {order.recipientName ? `, de regalo para ${order.recipientName}` : ""}.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Tienes hasta las <strong className="text-foreground">{deadline}</strong> para pagar. La
        giftcard se emite recién cuando se confirma el cobro.
      </p>

      <GiftOrderCheckout
        token={params.token}
        amountLabel={formatCLP(order.amount)}
        webpay={
          order.provider === "webpay" && order.providerRef
            ? { formAction: webpayFormUrl(), webpayToken: order.providerRef }
            : null
        }
      />
    </Shell>
  );
}
