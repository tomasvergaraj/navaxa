"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Button, Input, Label, NativeSelect } from "@navaxa/ui";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

type DepositType = "NONE" | "FIXED" | "PERCENT";

interface Props {
  tenant: {
    paymentsEnabled: boolean;
    depositType: DepositType;
    depositValue: number;
  };
}

const selectCls = "mt-1.5 md:w-72";

export function PaymentSettingsForm({ tenant }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    paymentsEnabled: tenant.paymentsEnabled,
    depositType: tenant.depositType,
    depositValue: tenant.depositValue,
  });
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const needsValue = form.depositType !== "NONE";
  const invalid = form.paymentsEnabled && needsValue && form.depositValue <= 0;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentsEnabled: form.paymentsEnabled,
          depositType: form.depositType,
          depositValue: form.depositValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success("Cambios guardados");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <p className="text-sm font-medium">Cobrar un abono al reservar</p>
          <p className="text-xs text-muted-foreground">
            El cliente paga una seña al agendar online. Reduce las inasistencias. La hora se libera
            si no paga en 20 minutos.
          </p>
        </div>
        <Switch
          checked={form.paymentsEnabled}
          onChange={(v) => set({ paymentsEnabled: v })}
          aria-label="Cobrar abono al reservar"
        />
      </div>

      {form.paymentsEnabled && (
        <div className="space-y-4 rounded-md border border-dashed border-border p-4">
          <div>
            <Label htmlFor="dep-type">Tipo de abono</Label>
            <NativeSelect
              id="dep-type"
              value={form.depositType}
              onChange={(e) => set({ depositType: e.target.value as DepositType })}
              className={selectCls}
            >
              <option value="NONE">Sin abono</option>
              <option value="FIXED">Monto fijo (CLP)</option>
              <option value="PERCENT">Porcentaje del total</option>
            </NativeSelect>
          </div>

          {needsValue && (
            <div>
              <Label htmlFor="dep-value">
                {form.depositType === "FIXED" ? "Monto del abono (CLP)" : "Porcentaje del total (%)"}
              </Label>
              <Input
                id="dep-value"
                type="number"
                min={1}
                max={form.depositType === "PERCENT" ? 100 : undefined}
                value={form.depositValue || ""}
                onChange={(e) => set({ depositValue: Number(e.target.value) })}
                className="mt-1.5 md:w-72"
                placeholder={form.depositType === "FIXED" ? "5000" : "50"}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {form.depositType === "FIXED"
                  ? "Se cobra este monto fijo (nunca más que el total del servicio)."
                  : "Usa 100 para cobrar el total por adelantado."}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || invalid}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
