"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Badge, cn } from "@navaxa/ui";
import { Check } from "lucide-react";
import { PLANS, ANNUAL_MONTHS_CHARGED } from "@navaxa/config";
import { formatCLP } from "@/lib/format";
import { Reveal } from "./reveal";

type Interval = "MONTHLY" | "ANNUAL";

const PLAN_LIST = [PLANS.STARTER, PLANS.PRO, PLANS.ENTERPRISE];

export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>("MONTHLY");
  const annual = interval === "ANNUAL";

  return (
    <>
      {/* Selector mensual / anual */}
      <Reveal className="mb-10 flex justify-center">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setInterval("MONTHLY")}
            className={cn(
              "rounded-md px-4 py-1.5 font-medium transition-colors",
              !annual ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setInterval("ANNUAL")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 font-medium transition-colors",
              annual ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Anual
            <span className="rounded-full bg-brand-brass/15 px-1.5 py-0.5 text-xs text-brand-brass">
              2 meses gratis
            </span>
          </button>
        </div>
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
                  popular ? "border-2 border-brand-brass shadow-md" : "hover:border-brand-brass/40",
                )}
              >
                {popular && (
                  <Badge variant="brand" className="absolute -top-2 right-6">
                    Más popular
                  </Badge>
                )}
                <h3 className="font-display text-lg font-medium">{plan.name}</h3>

                {annual ? (
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-medium tracking-tight">{formatCLP(yearPrice)}</span>
                      <span className="text-sm text-muted-foreground">/año</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ≈ {formatCLP(Math.round(yearPrice / 12))}/mes · 2 meses gratis
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-medium tracking-tight">{formatCLP(plan.priceClp)}</span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                )}

                <ul className="mt-6 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-brass" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={popular ? "default" : "outline"}
                  className="mt-6 w-full"
                  asChild
                >
                  <Link href="/registro">Empezar</Link>
                </Button>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
