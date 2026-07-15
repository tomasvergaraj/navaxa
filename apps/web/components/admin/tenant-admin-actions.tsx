"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@navaxa/ui";
import { toast } from "sonner";
import { Plan, SubscriptionStatus } from "@navaxa/db";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Props = {
  tenantId: string;
  initial: {
    active: boolean;
    plan: Plan;
    status: SubscriptionStatus | null;
    currentPeriodEnd: string | null;
  };
};

const PLAN_OPTIONS: Plan[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
const STATUS_OPTIONS: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"];

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export function TenantAdminActions({ tenantId, initial }: Props) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [plan, setPlan] = useState<Plan>(initial.plan);
  const [status, setStatus] = useState<SubscriptionStatus>(
    initial.status ?? SubscriptionStatus.TRIALING,
  );
  const [periodEnd, setPeriodEnd] = useState<string>(isoToDateInput(initial.currentPeriodEnd));

  async function patch(body: Record<string, unknown>, successMsg: string) {
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
    toast.success(successMsg);
    router.refresh();
  }

  async function saveSubscription() {
    setSaving(true);
    try {
      // periodEnd: si se vació explícitamente, mandamos null para limpiar.
      const periodIso = periodEnd ? new Date(periodEnd + "T23:59:59").toISOString() : null;
      await patch(
        {
          plan,
          subscription: { status, currentPeriodEnd: periodIso },
        },
        "Suscripción actualizada",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const next = !initial.active;
    const verb = next ? "Activar" : "Suspender";
    const ok = await confirm({
      title: `¿${verb} esta barbería?`,
      description: "Cambia el acceso de inmediato.",
      confirmText: verb,
      destructive: !next,
    });
    if (!ok) return;
    setToggling(true);
    try {
      await patch({ active: next }, next ? "Barbería activada" : "Barbería suspendida");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card className="space-y-5 p-5">
      <h2 className="text-sm font-medium">Acciones de soporte</h2>

      <div className="space-y-3 border-b border-border pb-4">
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Estado de suscripción</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ta-period">Vence el</Label>
          <Input
            id="ta-period"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Útil para extender un trial o un período pagado a mano.
          </p>
        </div>
        <Button onClick={saveSubscription} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar suscripción
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
          {initial.active
            ? "Suspender bloquea el acceso de toda la barbería sin borrar datos."
            : "Actualmente suspendida: nadie del tenant puede entrar."}
        </div>
        <Button
          variant="outline"
          onClick={toggleActive}
          disabled={toggling}
          className={
            initial.active
              ? "w-full border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:hover:bg-rose-950"
              : "w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:hover:bg-emerald-950"
          }
        >
          {toggling && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial.active ? "Suspender barbería" : "Reactivar barbería"}
        </Button>
      </div>
      {confirmDialog}
    </Card>
  );
}
