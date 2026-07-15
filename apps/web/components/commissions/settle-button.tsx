"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Undo2 } from "lucide-react";
import { Button, NativeSelect } from "@navaxa/ui";
import { toast } from "sonner";
import { formatCLP } from "@/lib/format";

type Props = {
  barberId: string;
  year: number;
  month: number; // 0-11
  pendingAmount: number;
  paidAmount: number;
};

export function SettleButton({ barberId, year, month, pendingAmount, paidAmount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"pay" | "revert" | null>(null);
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "OTHER">("CASH");

  async function settle(paid: boolean) {
    setLoading(paid ? "pay" : "revert");
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId, year, month, paid, ...(paid ? { method } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo procesar");
      toast.success(paid ? "Comisiones liquidadas" : "Liquidación revertida");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {pendingAmount > 0 && (
        <>
          <NativeSelect
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            disabled={loading !== null}
            aria-label="Método de pago"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="OTHER">Otro</option>
          </NativeSelect>
          <Button size="sm" onClick={() => settle(true)} disabled={loading !== null}>
            {loading === "pay" ? <Loader2 className="animate-spin" /> : <Check />}
            Liquidar {formatCLP(pendingAmount)}
          </Button>
        </>
      )}
      {paidAmount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => settle(false)}
          disabled={loading !== null}
          title="Revertir a pendiente"
        >
          {loading === "revert" ? <Loader2 className="animate-spin" /> : <Undo2 />}
          Revertir
        </Button>
      )}
    </div>
  );
}
