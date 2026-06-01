"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@navaxa/ui";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function PlanCheckout({
  token,
  priceLabel,
  priceSuffix = "/mes",
}: {
  token: string;
  priceLabel: string;
  priceSuffix?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/pay/${token}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo procesar el pago");
      }
      toast.success("¡Plan activado!");
      router.push("/configuracion?tab=plan");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      <Button className="w-full" onClick={pay} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Pagar {priceLabel}{priceSuffix}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => router.push("/configuracion?tab=plan")}
        disabled={loading}
      >
        Cancelar
      </Button>
    </div>
  );
}
