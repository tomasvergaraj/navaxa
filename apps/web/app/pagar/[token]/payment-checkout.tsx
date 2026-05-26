"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@navaxa/ui";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function PaymentCheckout({
  token,
  slug,
  amountLabel,
}: {
  token: string;
  slug: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"pay" | "cancel" | null>(null);

  async function pay() {
    setLoading("pay");
    try {
      const res = await fetch(`/api/public/pay/${token}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.manageToken) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo procesar el pago");
      }
      router.push(`/reservar/gestion/${data.manageToken}`);
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(null);
    }
  }

  async function cancel() {
    setLoading("cancel");
    try {
      await fetch(`/api/public/pay/${token}/cancel`, { method: "POST" });
    } finally {
      router.push(`/reservar/${slug}`);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      <Button className="w-full" onClick={pay} disabled={loading !== null}>
        {loading === "pay" && <Loader2 className="h-4 w-4 animate-spin" />}
        Pagar {amountLabel}
      </Button>
      <Button variant="ghost" className="w-full" onClick={cancel} disabled={loading !== null}>
        {loading === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
        Cancelar
      </Button>
    </div>
  );
}
