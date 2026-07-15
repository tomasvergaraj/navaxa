import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@navaxa/ui";
import { verifyBillingToken, planName, planPriceClp } from "@/lib/billing";
import { formatCLP } from "@/lib/format";
import { PLANS } from "@navaxa/config";
import { createWebpayTransaction, webpayFormUrl } from "@/lib/webpay";
import { PlanCheckout } from "./plan-checkout";
import { WebpayPlanCheckout } from "./webpay-plan-checkout";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function FacturarPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { ok?: string };
}) {
  const parsed = verifyBillingToken(params.token);

  if (!parsed) {
    return (
      <Shell>
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-medium">Enlace de pago no válido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vuelve a elegir tu plan desde la configuración.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/configuracion?tab=plan">Ir a planes</Link>
        </Button>
      </Shell>
    );
  }

  const price = planPriceClp(parsed.plan, parsed.interval);
  const features = PLANS[parsed.plan].features;
  const provider = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  const annual = parsed.interval === "ANNUAL";
  const priceSuffix = annual ? "/año" : "/mes";

  // Vuelta exitosa desde Webpay (o desde el flow mock al activar): pantalla de
  // confirmación con resumen y atajo a la configuración.
  if (searchParams?.ok === "1") {
    return (
      <Shell>
        <CheckCircle2 className="h-10 w-10 text-emerald-700 dark:text-emerald-400" />
        <h1 className="mt-4 font-display text-xl font-medium">¡Plan activado!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quedaste en plan <strong className="text-foreground">{planName(parsed.plan)}</strong> por{" "}
          <strong className="text-foreground">{formatCLP(price)}{priceSuffix}</strong>. La próxima
          renovación se cobra en {annual ? "12 meses" : "30 días"}.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/configuracion?tab=plan">Ver mi suscripción</Link>
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link href="/dashboard">Ir al panel</Link>
        </Button>
      </Shell>
    );
  }

  // Cuando el provider es Webpay, creamos una transacción al cargar esta página
  // y pasamos el token al formulario. Un refresh genera otra transacción —
  // Webpay tolera las abandonadas (caducan solas), así que es aceptable.
  let webpay: { token: string } | null = null;
  let webpayError: string | null = null;
  if (provider === "webpay") {
    try {
      const buyOrder = `nx_bill_${parsed.tenantId}`.slice(0, 26);
      const sessionId = `${parsed.tenantId}:${parsed.plan}:${parsed.interval}`.slice(0, 61);
      const created = await createWebpayTransaction({
        buy_order: buyOrder,
        session_id: sessionId,
        amount: price,
        return_url: `${APP_URL}/api/billing/webpay/return`,
      });
      webpay = { token: created.token };
    } catch (e) {
      // Log interno; al usuario solo un mensaje genérico (el error crudo de la
      // API de Transbank puede filtrar detalles).
      console.error("[facturar] Webpay create failed:", e);
      webpayError = "No pudimos iniciar el pago con Webpay. Intenta de nuevo en unos minutos.";
    }
  }

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Suscripción navaxa
      </p>
      <h1 className="mt-1 font-display text-xl font-medium">Plan {planName(parsed.plan)}</h1>

      <div className="mt-4 flex items-baseline gap-1 border-b border-border pb-4">
        <span className="font-display text-3xl font-medium">{formatCLP(price)}</span>
        <span className="text-sm text-muted-foreground">{priceSuffix}</span>
        {annual && (
          <span className="ml-2 rounded-full bg-brand-brass/15 px-2 py-0.5 text-xs font-medium text-brand-brass">
            2 meses gratis
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        {features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>

      {provider === "webpay" ? (
        webpay ? (
          <>
            <WebpayPlanCheckout
              priceLabel={formatCLP(price)}
              priceSuffix={priceSuffix}
              formAction={webpayFormUrl()}
              webpayToken={webpay.token}
            />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Pago seguro procesado por Webpay Plus de Transbank.
            </p>
          </>
        ) : (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            No se pudo conectar con Webpay. Intenta de nuevo en unos minutos.
            {webpayError && (
              <p className="mt-1 text-xs text-muted-foreground">{webpayError}</p>
            )}
          </div>
        )
      ) : (
        <>
          <PlanCheckout token={params.token} priceLabel={formatCLP(price)} priceSuffix={priceSuffix} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Pago de demostración (mock). No se cobra dinero real.
          </p>
        </>
      )}
    </Shell>
  );
}
