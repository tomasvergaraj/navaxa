"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Users } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  NativeSelect,
  Label,
} from "@navaxa/ui";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  BROADCAST_SEGMENTS,
  BROADCAST_TEMPLATES,
  BROADCAST_MAX_RECIPIENTS,
} from "@/lib/campaigns";

export function BroadcastDialog({ whatsappAvailable }: { whatsappAvailable: boolean }) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<string>("all");
  const [days, setDays] = useState("30");
  const [templateKey, setTemplateKey] = useState<string>(BROADCAST_TEMPLATES[0].key);
  const [channel, setChannel] = useState(whatsappAvailable ? "WHATSAPP" : "EMAIL");
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);

  const hasDays = BROADCAST_SEGMENTS.find((s) => s.key === segment)?.hasDays ?? false;
  const example = BROADCAST_TEMPLATES.find((t) => t.key === templateKey)?.example ?? "";

  // Vista previa del tamaño del segmento; se recalcula al cambiar segmento/días.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCounting(true);
    setCount(null);
    const params = new URLSearchParams({ segment, days });
    const t = setTimeout(() => {
      fetch(`/api/campaigns/broadcast?${params}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setCount(typeof d.count === "number" ? d.count : 0);
        })
        .catch(() => {
          if (!cancelled) setCount(null);
        })
        .finally(() => {
          if (!cancelled) setCounting(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, segment, days]);

  async function send() {
    if (count === 0) {
      toast.error("No hay clientes en este segmento.");
      return;
    }
    const segLabel = BROADCAST_SEGMENTS.find((s) => s.key === segment)?.label ?? "";
    const ok = await confirm({
      title: "Enviar ahora",
      description: `Se enviará el mensaje a ${count ?? "los"} cliente(s) de «${segLabel}» por ${channel === "WHATSAPP" ? "WhatsApp" : "email"}. Esta acción no se puede deshacer.`,
      confirmText: "Enviar",
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await fetch("/api/campaigns/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, days: Number(days), templateKey, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo enviar");
      const skipped = data.skipped ? ` · ${data.skipped} sin canal disponible` : "";
      toast.success(`Enviado a ${data.sent} cliente(s)${skipped}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" />
        Nuevo envío
      </Button>

      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Envío manual</DialogTitle>
            <DialogDescription>
              Manda un mensaje puntual a un grupo de clientes. Máximo{" "}
              {BROADCAST_MAX_RECIPIENTS} por envío.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-segment">A quién</Label>
              <NativeSelect
                id="bc-segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
              >
                {BROADCAST_SEGMENTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {hasDays && (
              <div className="space-y-1.5">
                <Label htmlFor="bc-days">Sin venir hace (días)</Label>
                <input
                  id="bc-days"
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="bc-template">Mensaje</Label>
              <NativeSelect
                id="bc-template"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
              >
                {BROADCAST_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {example}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bc-channel">Canal</Label>
              <NativeSelect
                id="bc-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">
                  WhatsApp{whatsappAvailable ? "" : " (degrada a email)"}
                </option>
              </NativeSelect>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {counting ? (
                <span className="text-muted-foreground">Calculando destinatarios…</span>
              ) : count === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span>
                  <strong className="tabular-nums">{count}</strong> cliente(s) recibirán este mensaje
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={send} disabled={sending || counting || count === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
