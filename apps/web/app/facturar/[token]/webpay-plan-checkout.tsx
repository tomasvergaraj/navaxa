"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@navaxa/ui";
import { Loader2 } from "lucide-react";

export function WebpayPlanCheckout({
  priceLabel,
  formAction,
  webpayToken,
}: {
  priceLabel: string;
  formAction: string;
  webpayToken: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"pay" | "cancel" | null>(null);

  function onSubmit(_e: FormEvent<HTMLFormElement>) {
    // POST nativo a Transbank; el navegador se va.
    setLoading("pay");
  }

  return (
    <div className="mt-6 space-y-2">
      <form method="POST" action={formAction} onSubmit={onSubmit}>
        <input type="hidden" name="token_ws" value={webpayToken} />
        <Button type="submit" className="w-full" disabled={loading !== null}>
          {loading === "pay" && <Loader2 className="h-4 w-4 animate-spin" />}
          Pagar {priceLabel}/mes con Webpay
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setLoading("cancel");
          router.push("/configuracion?tab=plan");
        }}
        disabled={loading !== null}
      >
        Cancelar
      </Button>
    </div>
  );
}
