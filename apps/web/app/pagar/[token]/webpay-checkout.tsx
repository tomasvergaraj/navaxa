"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@navaxa/ui";
import { Loader2 } from "lucide-react";

/**
 * Checkout para Webpay Plus: hace POST nativo del formulario a Transbank con
 * token_ws. El cancelar usa el endpoint existente que libera la hora.
 */
export function WebpayCheckout({
  token,
  slug,
  amountLabel,
  formAction,
  webpayToken,
}: {
  token: string;
  slug: string;
  amountLabel: string;
  formAction: string;
  webpayToken: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState<"pay" | "cancel" | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Deja que el browser haga el POST nativo a Transbank.
    setLoading("pay");
    // No prevenimos el default: el navegador se va a la URL de Webpay.
    void e;
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
      <form ref={formRef} method="POST" action={formAction} onSubmit={onSubmit}>
        <input type="hidden" name="token_ws" value={webpayToken} />
        <Button type="submit" className="w-full" disabled={loading !== null}>
          {loading === "pay" && <Loader2 className="h-4 w-4 animate-spin" />}
          Pagar {amountLabel} con Webpay
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={cancel}
        disabled={loading !== null}
      >
        {loading === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
        Cancelar
      </Button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Pago seguro procesado por Webpay Plus de Transbank.
      </p>
    </div>
  );
}
