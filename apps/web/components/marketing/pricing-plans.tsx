"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Badge, cn } from "@navaxa/ui";
import { Check } from "lucide-react";
import { PLANS, ANNUAL_MONTHS_CHARGED } from "@navaxa/config";
import { formatCLP } from "@/lib/format";
import { Reveal } from "./reveal";
import { IntervalToggle, type Interval } from "@/components/billing/interval-toggle";

const PLAN_LIST = [PLANS.STARTER, PLANS.PRO, PLANS.ENTERPRISE];

export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>("MONTHLY");
  const annual = interval === "ANNUAL";

  return (
    <>
      {/* Selector mensual / anual */}
      <Reveal className="mb-10 flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </Reveal>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {PLAN_LIST.map((plan, i) => {
          const popular = "popular" in plan && plan.popular;
          const yearPrice = plan.priceClp * ANNUAL_MONTHS_CHARGED;
          return (
            <Reveal key={plan.id} delay={i * 80} className="h-full">
              <Card
                className={cn(
                  "relative h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  popular ? "border-2 border-accent-ink shadow-md" : "hover:border-brand-brass/40",
                )}
              >
                {popular && (
                  <Badge variant="brand" className="absolute -top-2 right-6">
                    Más popular
                  </Badge>
                )}
                <h3 className="font-display text-lg font-medium">{plan.name}</h3>

                {annual ? (
                  <div key="annual" className="mt-3 animate-in fade-in duration-300">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-medium tracking-tight">{formatCLP(yearPrice)}</span>
                      <span className="text-sm text-muted-foreground">/año</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ≈ {formatCLP(Math.round(yearPrice / 12))}/mes · 2 meses gratis
                    </p>
                  </div>
                ) : (
                  <div key="monthly" className="mt-3 flex items-baseline gap-1 animate-in fade-in duration-300">
                    <span className="text-3xl font-medium tracking-tight">{formatCLP(plan.priceClp)}</span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                )}

                <ul className="mt-6 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={popular ? "default" : "outline"}
                  className="mt-6 w-full"
                  asChild
                >
                  <Link href={`/registro?plan=${plan.id.toLowerCase()}&interval=${interval.toLowerCase()}`}>Empezar</Link>
                </Button>
              </Card>
            </Reveal>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Al terminar los 14 días de prueba puedes seguir en el plan{" "}
        <strong className="text-foreground">Gratis</strong> (1 barbero, hasta 50 clientes, agenda
        básica) o elegir un plan pagado. Sin cobros automáticos sorpresa.
      </p>
    </>
  );
}
