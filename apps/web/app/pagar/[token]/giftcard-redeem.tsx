"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@navaxa/ui";
import { toast } from "sonner";
import { Loader2, Gift } from "lucide-react";

/**
 * Canje de giftcard contra el abono. Si el saldo cubre todo, el server confirma
 * la reserva y acá saltamos directo a la gestión; si cubre parte, recarga la
 * página para que el checkout quede armado con el nuevo monto (y, en Webpay, con
 * la transacción recreada por la diferencia).
 */
export function GiftCardRedeem({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function apply() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/public/pay/${token}/giftcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo aplicar la giftcard");
      }
      if (data.covered && data.manageToken) {
        router.push(`/reservar/gestion/${data.manageToken}`);
        return;
      }
      toast.success("Saldo aplicado. Paga la diferencia para confirmar.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <Gift className="h-4 w-4" />
        Tengo una giftcard
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border p-4">
      <Label htmlFor="gc-code" className="text-xs">
        Código de la giftcard
      </Label>
      <div className="flex gap-2">
        <Input
          id="gc-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void apply();
          }}
          placeholder="NVX-XXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={loading}
          className="uppercase"
        />
        <Button type="button" onClick={apply} disabled={loading || !code.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Aplicar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Si el saldo alcanza para todo el abono, la reserva queda confirmada al tiro.
      </p>
    </div>
  );
}
