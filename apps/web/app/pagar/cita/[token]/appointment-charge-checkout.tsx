"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@navaxa/ui";
import { Loader2 } from "lucide-react";

/**
 * Pago del saldo de una cita desde el teléfono del cliente.
 *
 * Con Webpay: POST nativo del formulario a Transbank con `token_ws` (igual que
 * el abono y la compra de giftcard). Con el proveedor mock (dev/sandbox): botón
 * que llama al endpoint de confirmación simulada.
 */
export function AppointmentChargeCheckout({
  token,
  amountLabel,
  webpay,
}: {
  token: string;
  amountLabel: string;
  webpay: { formAction: string; webpayToken: string } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onWebpaySubmit(e: FormEvent<HTMLFormElement>) {
    // Sin preventDefault: el browser se va a la URL de Webpay.
    setLoading(true);
    void e;
  }

  async function payMock() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/appointment-charge/${token}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo confirmar el pago.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {webpay ? (
        <form method="POST" action={webpay.formAction} onSubmit={onWebpaySubmit}>
          <input type="hidden" name="token_ws" value={webpay.webpayToken} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Pagar {amountLabel} con Webpay
          </Button>
        </form>
      ) : (
        <Button type="button" className="w-full" onClick={payMock} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Pagar {amountLabel} (simulado)
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {webpay
          ? "Pago seguro procesado por Webpay Plus de Transbank."
          : "Proveedor de pago simulado (entorno de prueba)."}
      </p>
    </div>
  );
}
