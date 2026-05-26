import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@navaxa/ui";
import { verifyBillingToken, planName, planPriceClp } from "@/lib/billing";
import { formatCLP } from "@/lib/format";
import { PLANS } from "@navaxa/config";
import { PlanCheckout } from "./plan-checkout";

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

export default function FacturarPage({ params }: { params: { token: string } }) {
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

  const price = planPriceClp(parsed.plan);
  const features = PLANS[parsed.plan].features;

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Suscripción navaxa
      </p>
      <h1 className="mt-1 font-display text-xl font-medium">Plan {planName(parsed.plan)}</h1>

      <div className="mt-4 flex items-baseline gap-1 border-b border-border pb-4">
        <span className="font-display text-3xl font-medium">{formatCLP(price)}</span>
        <span className="text-sm text-muted-foreground">/mes</span>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        {features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>

      <PlanCheckout token={params.token} priceLabel={formatCLP(price)} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Pago de demostración (mock). No se cobra dinero real.
      </p>
    </Shell>
  );
}
