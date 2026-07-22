"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Loader2, MessageCircle, Trash2 } from "lucide-react";
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
} from "@navaxa/ui";
import { toast } from "sonner";
import { formatCLP } from "@/lib/format";

type ChargeLink = { url: string; amount: number; expiresAt: string; qr: string };

type Props = {
  appointmentId: string;
  clientName: string;
  clientPhone: string | null;
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Cobro del saldo por link/QR: el cliente paga con Webpay desde su propio
 * teléfono. El QR llega ya renderizado desde el server (data URL) para no meter
 * la librería `qrcode` en el bundle del cliente.
 *
 * Si la cita ya tiene un enlace vigente se muestra ese, en vez de emitir un
 * segundo QR por la misma deuda.
 */
export function ChargeLinkDialog({
  appointmentId,
  clientName,
  clientPhone,
  balance,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(balance));
  const [link, setLink] = useState<ChargeLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // Al abrir: buscar el enlace vigente, si lo hay.
  useEffect(() => {
    if (!open) return;
    setAmount(String(balance));
    setLink(null);
    setChecking(true);
    fetch(`/api/appointments/${appointmentId}/charge`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.pendingLink) setLink(d.pendingLink as ChargeLink);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [open, appointmentId, balance]);

  const parsed = Math.round(Number(amount));
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= balance;

  async function generate() {
    if (!valid || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/charge-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "No se pudo generar el enlace");
      }
      setLink(data as ChargeLink);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelLink() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/charge-link`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No se pudo anular el enlace");
      setLink(null);
      toast.success("Enlace anulado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace a mano.");
    }
  }

  const waHref = link ? whatsappShareUrl(clientPhone, waText(link)) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobrar por link o QR</DialogTitle>
        </DialogHeader>

        {!link ? (
          <div className="space-y-4">
            <Card className="p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo de la cita</span>
                <span className="tabular-nums font-medium">{formatCLP(balance)}</span>
              </div>
            </Card>

            <div className="space-y-1.5">
              <Label htmlFor="link-amount">Monto del cobro</Label>
              <Input
                id="link-amount"
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
            </div>

            <p className="text-xs text-muted-foreground">
              El cliente paga con Webpay desde su teléfono. El cobro queda registrado solo
              cuando la pasarela confirma el pago; el enlace vence en 24 horas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="flex flex-col items-center gap-2 p-4">
              {/* El QR viene como data URL desde el server: `next/image` no
                  aporta nada acá y solo agrega su pipeline de optimización. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={link.qr}
                alt={`Código QR para pagar ${formatCLP(link.amount)}`}
                width={200}
                height={200}
                className="h-[200px] w-[200px] rounded-md bg-white p-2"
              />
              <p className="text-sm font-medium tabular-nums">{formatCLP(link.amount)}</p>
              <p className="text-center text-xs text-muted-foreground">
                Muéstrale el código al cliente o mándale el enlace.
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copiar enlace
              </Button>
              {waHref ? (
                <Button asChild variant="outline">
                  <a href={waHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled title="El cliente no tiene teléfono registrado">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              )}
            </div>

            <p className="break-all text-center text-[11px] text-muted-foreground">{link.url}</p>

            <Button
              variant="ghost"
              className="w-full text-destructive"
              onClick={cancelLink}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Anular enlace
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cerrar
          </Button>
          {!link && (
            <Button onClick={generate} disabled={!valid || loading || checking}>
              {loading || checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Generar enlace
            </Button>
          )}
        </DialogFooter>

        <p className="sr-only">Enlace de cobro del saldo de la cita de {clientName}</p>
      </DialogContent>
    </Dialog>
  );
}

function waText(link: ChargeLink): string {
  return `Hola! Acá puedes pagar el saldo de tu cita (${formatCLP(link.amount)}):\n${link.url}`;
}

/**
 * Deep link de WhatsApp (wa.me). NO pasa por la Cloud API de Meta: lo abre el
 * teléfono del dueño y no tiene costo por mensaje.
 *
 * Los teléfonos chilenos se guardan de varias formas (+56 9…, 9…, con espacios):
 * se normaliza a solo dígitos y se antepone 56 cuando falta el país.
 */
function whatsappShareUrl(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 8) return null;
  if (!digits.startsWith("56") && digits.length <= 9) digits = `56${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
