"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea, cn } from "@navaxa/ui";
import { Loader2 } from "lucide-react";
import { TurnstileWidget } from "@/components/booking/turnstile-widget";
import { formatCLP } from "@/lib/format";

const PRESETS = [10000, 15000, 20000, 30000];
const MIN = 1000;
const MAX = 1_000_000;

/**
 * Compra de giftcard desde la vitrina. No emite nada: crea la orden y manda al
 * checkout, que es quien cobra. Por eso el submit navega en vez de mostrar éxito.
 */
export function GiftPurchaseForm({
  slug,
  turnstileSiteKey,
}: {
  slug: string;
  turnstileSiteKey: string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(PRESETS[1]);
  const [custom, setCustom] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usingCustom = custom !== "";
  const finalAmount = usingCustom ? Math.round(Number(custom) || 0) : amount;
  const amountValid = finalAmount >= MIN && finalAmount <= MAX;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!amountValid) {
      setError(`El monto debe estar entre ${formatCLP(MIN)} y ${formatCLP(MAX)}.`);
      return;
    }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/giftcards/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalAmount,
          buyerName: String(fd.get("buyerName") ?? ""),
          buyerEmail: String(fd.get("buyerEmail") ?? ""),
          recipientName: String(fd.get("recipientName") ?? ""),
          recipientEmail: String(fd.get("recipientEmail") ?? ""),
          message: String(fd.get("message") ?? ""),
          captchaToken: captcha ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: unknown };
      if (!res.ok || !data.url) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo iniciar la compra. Revisa los datos e intenta de nuevo.",
        );
        setLoading(false);
        return;
      }
      // No soltamos el loading: la navegación al checkout deja el botón ocupado.
      router.push(data.url);
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Monto</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={!usingCustom && amount === p}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                !usingCustom && amount === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              {formatCLP(p)}
            </button>
          ))}
        </div>
        <div>
          <Label htmlFor="custom">Otro monto</Label>
          <Input
            id="custom"
            inputMode="numeric"
            placeholder="Ej. 25000"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
            className="mt-1"
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="buyerName">Tu nombre</Label>
          <Input id="buyerName" name="buyerName" required maxLength={80} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="buyerEmail">Tu email</Label>
          <Input
            id="buyerEmail"
            name="buyerEmail"
            type="email"
            required
            maxLength={120}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="recipientName">Para (opcional)</Label>
          <Input id="recipientName" name="recipientName" maxLength={80} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="recipientEmail">Email de quien la recibe (opcional)</Label>
          <Input
            id="recipientEmail"
            name="recipientEmail"
            type="email"
            maxLength={120}
            className="mt-1"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Si dejas el email de quien la recibe, le llega el código apenas se confirme el pago. Si no,
        te llega a ti.
      </p>

      <div>
        <Label htmlFor="message">Mensaje (opcional)</Label>
        <Textarea id="message" name="message" maxLength={300} rows={3} className="mt-1" />
      </div>

      {turnstileSiteKey && (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptcha} action="giftcard" />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading || !amountValid}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Continuar al pago{amountValid ? ` · ${formatCLP(finalAmount)}` : ""}
      </Button>
    </form>
  );
}
