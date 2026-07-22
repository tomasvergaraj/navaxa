"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, cn } from "@navaxa/ui";
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

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
        {PLAN_LIST.map((plan, i) => {
          const popular = "popular" in plan && plan.popular;
          const yearPrice = plan.priceClp * ANNUAL_MONTHS_CHARGED;
          return (
            <Reveal key={plan.id} variant="scale" delay={i * 90} className="h-full">
              {/* El plan popular es la card "tinta" (graphite fijo en ambos temas,
                  como la CTA final); el resto son cards planas radius 24. */}
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-3xl p-7",
                  popular
                    ? "border border-white/10 bg-brand-graphite text-brand-ivory"
                    : "border border-border/60 bg-card transition-colors duration-300 hover:border-foreground/25",
                )}
              >
                {popular && (
                  <span className="absolute -top-3 right-6 rounded-full bg-brand-brass px-2.5 py-1 text-xs font-medium text-brand-graphite">
                    Más popular
                  </span>
                )}
                <h3 className="font-display text-lg font-medium">{plan.name}</h3>

                {annual ? (
                  <div key="annual" className="mt-3 animate-in fade-in duration-300">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-medium tracking-tight">{formatCLP(yearPrice)}</span>
                      <span className={cn("text-sm", popular ? "text-brand-ivory/70" : "text-muted-foreground")}>/año</span>
                    </div>
                    <p className={cn("mt-0.5 text-xs", popular ? "text-brand-ivory/70" : "text-muted-foreground")}>
                      ≈ {formatCLP(Math.round(yearPrice / 12))}/mes · 2 meses gratis
                    </p>
                  </div>
                ) : (
                  <div key="monthly" className="mt-3 flex items-baseline gap-1 animate-in fade-in duration-300">
                    <span className="text-4xl font-medium tracking-tight">{formatCLP(plan.priceClp)}</span>
                    <span className={cn("text-sm", popular ? "text-brand-ivory/70" : "text-muted-foreground")}>/mes</span>
                  </div>
                )}

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          popular ? "text-brand-brass" : "text-accent-ink",
                        )}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "mt-7 w-full rounded-full",
                    popular
                      ? "bg-brand-brass text-brand-graphite hover:bg-brand-brass-soft"
                      : "border border-foreground/25 bg-transparent text-foreground hover:border-foreground/50 hover:bg-transparent",
                  )}
                  variant={popular ? "default" : "outline"}
                  asChild
                >
                  <Link href={`/registro?plan=${plan.id.toLowerCase()}&interval=${interval.toLowerCase()}`}>Empezar</Link>
                </Button>

                {/* Enterprise incluye multi-local e integraciones a medida: eso
                    no se resuelve solo con el alta self-service. */}
                {plan.id === "ENTERPRISE" && (
                  <a
                    href="mailto:contacto@navaxa.cl?subject=Plan%20Enterprise"
                    className="mt-3 text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    ¿Multi-local o integración a medida? Escríbenos
                  </a>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
      {/* Plan Gratis: visible pero sin competir con los pagados (no es 4ª card
          a propósito: el primer precio de la grilla ancla la percepción). */}
      <Reveal variant="fade" className="mx-auto mt-6 max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-border/60 bg-card p-6 sm:flex-row sm:items-center sm:gap-6">
          <div>
            <p className="font-medium">
              Plan Gratis · <span className="text-accent-ink">$0 para siempre</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {PLANS.FREE.limits.barbers} barbero · hasta {PLANS.FREE.limits.clients} clientes ·
              agenda y reservas online básicas
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 rounded-full border-foreground/25 bg-transparent px-6 hover:border-foreground/50 hover:bg-transparent"
            asChild
          >
            <Link href="/registro">Empezar gratis</Link>
          </Button>
        </div>
      </Reveal>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Todos los planes parten con 14 días de prueba con todo incluido, sin tarjeta.
        Al terminar eliges plan o sigues en Gratis. Sin cobros automáticos sorpresa.
      </p>
    </>
  );
}
