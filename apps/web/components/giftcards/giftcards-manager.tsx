"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Plus,
  Loader2,
  Search,
  Copy,
  Check,
  Ban,
  Wallet,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  NativeSelect,
} from "@navaxa/ui";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { formatCLP } from "@/lib/format";

type Status = "ACTIVE" | "REDEEMED" | "EXPIRED" | "CANCELLED";

interface GiftCard {
  id: string;
  code: string;
  initialValue: number;
  balance: number;
  status: Status;
  buyerName: string | null;
  recipientName: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const STATUS: Record<Status, { label: string; variant: "success" | "outline" | "destructive" | "warning" }> = {
  ACTIVE: { label: "Activa", variant: "success" },
  REDEEMED: { label: "Sin saldo", variant: "outline" },
  EXPIRED: { label: "Vencida", variant: "warning" },
  CANCELLED: { label: "Anulada", variant: "destructive" },
};

async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo completar");
  return data;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

export function GiftCardsManager({
  cards,
  outstanding,
}: {
  cards: GiftCard[];
  outstanding: { balance: number; count: number };
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const [issuing, setIssuing] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    buyerName: "",
    recipientName: "",
    recipientEmail: "",
    message: "",
    expiresInMonths: "12",
  });
  const [issued, setIssued] = useState<GiftCard | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Canje por código
  const [redeem, setRedeem] = useState<{ card: GiftCard; amount: string } | null>(null);
  const [lookupCode, setLookupCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  async function issue() {
    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount < 1000) {
      toast.error("El monto mínimo es $1.000");
      return;
    }
    setIssuing(true);
    try {
      const { giftCard } = await apiJson("/api/giftcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          buyerName: form.buyerName || undefined,
          recipientName: form.recipientName || undefined,
          recipientEmail: form.recipientEmail || undefined,
          message: form.message || undefined,
          expiresInMonths: Number(form.expiresInMonths),
        }),
      });
      setIssueOpen(false);
      setForm({ amount: "", buyerName: "", recipientName: "", recipientEmail: "", message: "", expiresInMonths: "12" });
      setIssued(giftCard);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIssuing(false);
    }
  }

  async function lookup() {
    const code = lookupCode.trim();
    if (code.length < 4) {
      toast.error("Ingresa el código de la giftcard");
      return;
    }
    setLooking(true);
    try {
      const { giftCard } = await apiJson(`/api/giftcards/lookup?code=${encodeURIComponent(code)}`);
      setRedeem({ card: giftCard, amount: String(giftCard.balance) });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function doRedeem() {
    if (!redeem) return;
    const amount = Number(redeem.amount);
    if (Number.isNaN(amount) || amount < 1) {
      toast.error("Monto inválido");
      return;
    }
    setRedeeming(true);
    try {
      const { giftCard } = await apiJson(`/api/giftcards/${redeem.card.id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      toast.success(
        giftCard.balance > 0
          ? `Canjeado ${formatCLP(amount)} — saldo ${formatCLP(giftCard.balance)}`
          : `Canjeado ${formatCLP(amount)} — giftcard sin saldo`,
      );
      setRedeem(null);
      setLookupCode("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRedeeming(false);
    }
  }

  async function cancel(card: GiftCard) {
    const ok = await confirm({
      title: `¿Anular giftcard ${card.code}?`,
      description: `Quedará sin efecto y no se podrá canjear (saldo actual ${formatCLP(card.balance)}).`,
      confirmText: "Anular",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(card.id);
    try {
      await apiJson(`/api/giftcards/${card.id}`, { method: "DELETE" });
      toast.success("Giftcard anulada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-6">
      {/* Resumen + acciones */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <Card className="flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Saldo en circulación
            </div>
            <div className="text-xl font-medium tabular-nums">
              {formatCLP(outstanding.balance)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {outstanding.count} activa{outstanding.count === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </Card>
        <div className="flex items-end gap-2">
          <Button onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4" />
            Emitir giftcard
          </Button>
        </div>
      </div>

      {/* Canje por código */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Canjear
        </h2>
        <div className="flex flex-wrap gap-2">
          <Input
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lookup();
              }
            }}
            placeholder="Código de la giftcard, ej: NVX-8F3K2A"
            className="max-w-xs font-mono uppercase"
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="secondary" onClick={lookup} disabled={looking}>
            {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>
      </Card>

      {/* Listado */}
      {cards.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Aún no emites giftcards"
          description="Vende saldo por adelantado: el cliente paga hoy y lo consume en próximas visitas."
          action={
            <Button onClick={() => setIssueOpen(true)}>
              <Plus className="h-4 w-4" />
              Emitir la primera
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Para</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Vence</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-4 py-3">
                      <div className="truncate">{c.recipientName ?? "—"}</div>
                      {c.buyerName && (
                        <div className="text-xs text-muted-foreground">de {c.buyerName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCLP(c.balance)}
                      {c.balance !== c.initialValue && (
                        <span className="block text-xs text-muted-foreground">
                          de {formatCLP(c.initialValue)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.expiresAt ? fmtDate(c.expiresAt) : "Sin vencimiento"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === "ACTIVE" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRedeem({ card: c, amount: String(c.balance) })}
                            >
                              Canjear
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancel(c)}
                              disabled={busyId === c.id}
                              title="Anular"
                            >
                              {busyId === c.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                              <span className="sr-only">Anular {c.code}</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Emitir */}
      <Dialog open={issueOpen} onOpenChange={(o) => !issuing && setIssueOpen(o)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emitir giftcard</DialogTitle>
            <DialogDescription>
              El código se genera automáticamente. Si pones un email, le enviamos la giftcard al
              destinatario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="g-amount">Monto (CLP)</Label>
                <Input
                  id="g-amount"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="20000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-exp">Validez</Label>
                <NativeSelect
                  id="g-exp"
                  value={form.expiresInMonths}
                  onChange={(e) => setForm((f) => ({ ...f, expiresInMonths: e.target.value }))}
                >
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                  <option value="24">24 meses</option>
                  <option value="0">Sin vencimiento</option>
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="g-buyer">Comprador (opcional)</Label>
                <Input
                  id="g-buyer"
                  value={form.buyerName}
                  onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-recipient">Destinatario (opcional)</Label>
                <Input
                  id="g-recipient"
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Email del destinatario (opcional)</Label>
              <Input
                id="g-email"
                type="email"
                value={form.recipientEmail}
                onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                placeholder="Le enviamos el código por correo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-msg">Mensaje (opcional)</Label>
              <Textarea
                id="g-msg"
                rows={2}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="¡Feliz cumpleaños!"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssueOpen(false)} disabled={issuing}>
              Cancelar
            </Button>
            <Button onClick={issue} disabled={issuing}>
              {issuing && <Loader2 className="h-4 w-4 animate-spin" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Giftcard emitida (mostrar código) */}
      <Dialog open={issued !== null} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Giftcard emitida 🎁</DialogTitle>
            <DialogDescription className="text-center">
              {issued && formatCLP(issued.initialValue)} de saldo. Comparte este código con el
              cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="my-2 flex items-center justify-center gap-2">
            <span className="rounded-md border border-border bg-muted/40 px-4 py-2.5 font-mono text-lg font-medium tracking-wide">
              {issued?.code}
            </span>
            <Button variant="outline" size="sm" onClick={() => issued && copyCode(issued.code)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">Copiar código</span>
            </Button>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setIssued(null)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Canjear */}
      <Dialog open={redeem !== null} onOpenChange={(o) => !redeeming && !o && setRedeem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Canjear {redeem?.card.code}</DialogTitle>
            <DialogDescription>
              Saldo disponible:{" "}
              <strong className="tabular-nums">{redeem && formatCLP(redeem.card.balance)}</strong>.
              Puedes canjear una parte o el total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="r-amount">Monto a canjear</Label>
            <Input
              id="r-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={redeem?.card.balance}
              value={redeem?.amount ?? ""}
              onChange={(e) => setRedeem((r) => (r ? { ...r, amount: e.target.value } : r))}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRedeem(null)} disabled={redeeming}>
              Cancelar
            </Button>
            <Button onClick={doRedeem} disabled={redeeming}>
              {redeeming && <Loader2 className="h-4 w-4 animate-spin" />}
              Canjear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
