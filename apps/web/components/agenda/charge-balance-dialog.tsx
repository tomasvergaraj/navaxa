"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  cn,
} from "@navaxa/ui";
import { toast } from "sonner";
import { formatCLP } from "@/lib/format";
import { PAYMENT_METHODS, type ChoosablePaymentMethod } from "@/lib/payment-methods";

type Props = {
  appointmentId: string;
  clientName: string;
  totalPrice: number;
  paidAmount: number;
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama tras un cobro exitoso, antes del refresh. */
  onCharged?: () => void;
};

/**
 * Cobro del saldo pendiente de una cita. El monto viene prellenado con el saldo
 * completo pero se puede bajar: una cita admite varios cobros parciales, y el
 * server revalida contra el saldo real en cada uno.
 *
 * «Tarjeta» cubre cualquier POS — incluido Tap to Pay de SumUp, que se cobra en
 * su propia app y se registra acá con el nº de operación en la nota.
 */
export function ChargeBalanceDialog({
  appointmentId,
  clientName,
  totalPrice,
  paidAmount,
  balance,
  open,
  onOpenChange,
  onCharged,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<ChoosablePaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = Math.round(Number(amount));
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= balance;
  const remaining = valid ? balance - parsed : balance;

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    if (next) {
      // Reset al abrir: el saldo pudo cambiar desde el último cobro.
      setAmount(String(balance));
      setMethod("CASH");
      setNote("");
    }
    onOpenChange(next);
  }

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, paymentMethod: method, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo registrar el cobro");
      toast.success(
        remaining > 0
          ? `Cobro de ${formatCLP(parsed)} registrado — queda ${formatCLP(remaining)}`
          : `Cobro de ${formatCLP(parsed)} registrado — cita saldada`,
      );
      // Cerrar antes de avisar: `onCharged` puede desmontar este diálogo
      // (el detalle de la cita se cierra al cobrar).
      onOpenChange(false);
      router.refresh();
      onCharged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobrar saldo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="space-y-1 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total del servicio</span>
              <span className="tabular-nums">{formatCLP(totalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ya pagado</span>
              <span className="tabular-nums">{formatCLP(paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Saldo</span>
              <span className="tabular-nums">{formatCLP(balance)}</span>
            </div>
          </Card>

          <div className="space-y-1.5">
            <Label htmlFor="charge-amount">Monto a cobrar</Label>
            <Input
              id="charge-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!valid && amount !== "" && (
              <p className="text-xs text-destructive">
                Debe ser un monto entre $1 y {formatCLP(balance)}.
              </p>
            )}
            {valid && remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                Cobro parcial: quedarían {formatCLP(remaining)} por cobrar.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Método</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={method === m.key}
                  onClick={() => setMethod(m.key)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
                    method === m.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>
            {method === "CARD" && (
              <p className="text-xs text-muted-foreground">
                Cobra en el POS o en la app de SumUp y anota abajo el nº de operación.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="charge-note">Nota (opcional)</Label>
            <Input
              id="charge-note"
              maxLength={200}
              placeholder="Ej: SumUp op. 4821"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Cobrar {valid ? formatCLP(parsed) : ""}
          </Button>
        </DialogFooter>

        <p className="sr-only">Cobro del saldo de la cita de {clientName}</p>
      </DialogContent>
    </Dialog>
  );
}
