"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, cn } from "@navaxa/ui";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { PLANS, ANNUAL_MONTHS_CHARGED } from "@navaxa/config";
import { formatCLP } from "@/lib/format";
import { IntervalToggle, type Interval } from "@/components/billing/interval-toggle";

type Plan = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
type Status = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

interface Props {
  currentPlan: Plan;
  /** Mensajes WhatsApp del mes en curso vs cupo del plan (limit 0 = sin WhatsApp). */
  whatsappUsage: { used: number; limit: number };
  trialEndsAt: string | null;
  subscription: { status: Status; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
}

const PAID: Plan[] = ["STARTER", "PRO", "ENTERPRISE"];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

export function PlanManager({ currentPlan, whatsappUsage, trialEndsAt, subscription }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [interval, setBillingInterval] = useState<Interval>("MONTHLY");

  const status = subscription?.status;
  const periodEnd = subscription?.currentPeriodEnd ?? null;
  const cancelAtEnd = subscription?.cancelAtPeriodEnd ?? false;
  const trialActive = !!trialEndsAt && new Date(trialEndsAt) > new Date() && status !== "ACTIVE";

  async function action(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Algo salió mal");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      toast.success("Plan actualizado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const changePlan = (plan: Plan) =>
    action({ action: "checkout", plan, interval }, `pay-${plan}`);
  const cancel = () => action({ action: "cancel" }, "cancel");
  const reactivate = () => action({ action: "reactivate" }, "reactivate");

  // Texto de estado.
  let statusLine: React.ReactNode = null;
  if (status === "PAST_DUE") {
    statusLine = (
      <span className="text-destructive">
        Tu pago venció. Renueva para mantener tu plan {PLANS[currentPlan].name}.
      </span>
    );
  } else if (status === "ACTIVE" && cancelAtEnd) {
    statusLine = <>Tu plan se cancela el {fmtDate(periodEnd)}. Luego pasarás a Gratis.</>;
  } else if (status === "ACTIVE") {
    statusLine = <>Se renueva el {fmtDate(periodEnd)}.</>;
  } else if (trialActive) {
    statusLine = <>Estás en período de prueba hasta el {fmtDate(trialEndsAt)}.</>;
  } else if (currentPlan === "FREE") {
    statusLine = <>Estás en el plan Gratis.</>;
  } else {
    // Plan pagado sin suscripción activa registrada (p. ej. cuenta antigua).
    statusLine = <>Tienes el plan {PLANS[currentPlan].name}.</>;
  }

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Plan actual
            </h2>
            <p className="mt-2 font-display text-2xl font-medium">{PLANS[currentPlan].name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{statusLine}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={status === "PAST_DUE" ? "destructive" : "brand"}>{PLANS[currentPlan].name}</Badge>
            {status === "ACTIVE" && cancelAtEnd && (
              <Button size="sm" variant="outline" onClick={reactivate} disabled={busy !== null}>
                {busy === "reactivate" && <Loader2 className="h-4 w-4 animate-spin" />}
                Reactivar
              </Button>
            )}
            {currentPlan !== "FREE" && !cancelAtEnd && (
              <Button size="sm" variant="ghost" onClick={cancel} disabled={busy !== null}>
                {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
                Cambiar a Gratis
              </Button>
            )}
          </div>
        </div>

        {whatsappUsage.limit > 0 && (() => {
          const pct = (whatsappUsage.used / whatsappUsage.limit) * 100;
          return (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Mensajes WhatsApp este mes</span>
                <span>
                  {whatsappUsage.used.toLocaleString("es-CL")} /{" "}
                  {whatsappUsage.limit.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-foreground",
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              {pct >= 80 && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">
                  {pct >= 100
                    ? "Cupo agotado: hasta fin de mes los recordatorios saldrán por email."
                    : "Cerca del límite: al agotarse el cupo, los recordatorios saldrán por email."}
                </p>
              )}
            </div>
          );
        })()}
      </Card>

      {/* Selector mensual / anual */}
      <div className="flex items-center justify-center">
        <IntervalToggle value={interval} onChange={setBillingInterval} />
      </div>

      {/* Planes disponibles */}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID.map((plan) => {
          const p = PLANS[plan];
          const isCurrent = plan === currentPlan;
          const popular = "popular" in p && p.popular;
          return (
            <Card
              key={plan}
              className={cn("relative flex flex-col p-5", isCurrent && "border-foreground ring-1 ring-foreground")}
            >
              {popular && !isCurrent && (
                <Badge variant="brand" className="absolute -top-2 right-4">
                  Popular
                </Badge>
              )}
              <h3 className="font-display text-lg font-medium">{p.name}</h3>
              {interval === "ANNUAL" ? (
                <div key="annual" className="mt-1 animate-in fade-in duration-300">
                  <p>
                    <span className="font-display text-2xl font-medium">
                      {formatCLP(p.priceClp * ANNUAL_MONTHS_CHARGED)}
                    </span>
                    <span className="text-sm text-muted-foreground">/año</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCLP(Math.round((p.priceClp * ANNUAL_MONTHS_CHARGED) / 12))}/mes · 2 meses gratis
                  </p>
                </div>
              ) : (
                <p key="monthly" className="mt-1 animate-in fade-in duration-300">
                  <span className="font-display text-2xl font-medium">{formatCLP(p.priceClp)}</span>
                  <span className="text-sm text-muted-foreground">/mes</span>
                </p>
              )}
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-ink" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                variant={isCurrent ? "outline" : "default"}
                disabled={busy !== null || (isCurrent && status === "ACTIVE")}
                onClick={() => changePlan(plan)}
              >
                {busy === `pay-${plan}` && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCurrent && status === "ACTIVE" ? "Plan actual" : isCurrent ? "Renovar" : "Cambiar a " + p.name}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
