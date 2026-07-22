"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Undo2,
  Package,
  Scissors,
  Gift,
  X,
} from "lucide-react";
import { Button, Card, Badge, Input, Label, NativeSelect, cn } from "@navaxa/ui";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatCLP, formatTime } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/payment-methods";

interface ProductOpt {
  id: string;
  name: string;
  price: number;
  stock: number;
}
interface ServiceOpt {
  id: string;
  name: string;
  price: number;
}
interface SaleRow {
  id: string;
  createdAt: string;
  total: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER" | "GIFTCARD";
  /** APPOINTMENT_BALANCE = cobro del saldo de una cita, no venta de mostrador. */
  kind: "COUNTER" | "APPOINTMENT_BALANCE";
  giftCardAmount: number;
  giftCardCode: string | null;
  cancelledAt: string | null;
  clientName: string | null;
  items: { name: string; qty: number; unitPrice: number }[];
}

/** Giftcard validada contra el server, lista para aplicar al cobro. */
interface AppliedCard {
  code: string;
  balance: number;
}

interface CartLine {
  key: string; // productId o serviceId
  kind: "product" | "service";
  name: string;
  unitPrice: number;
  qty: number;
  maxQty?: number; // stock disponible (solo productos)
}

const METHODS = PAYMENT_METHODS;
const METHOD_LABEL = PAYMENT_METHOD_LABEL;

export function CashRegister({
  products,
  services,
  barbers,
  isManager,
  giftCardsEnabled,
  initialSales,
}: {
  products: ProductOpt[];
  services: ServiceOpt[];
  barbers: { id: string; name: string }[];
  isManager: boolean;
  giftCardsEnabled: boolean;
  initialSales: SaleRow[];
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const [tab, setTab] = useState<"product" | "service">(products.length > 0 ? "product" : "service");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<(typeof METHODS)[number]["key"]>("CASH");
  const [barberId, setBarberId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busySale, setBusySale] = useState<string | null>(null);
  const [cardCode, setCardCode] = useState("");
  const [card, setCard] = useState<AppliedCard | null>(null);
  const [checkingCard, setCheckingCard] = useState(false);

  const q = query.trim().toLowerCase();
  const filteredProducts = useMemo(
    () => products.filter((p) => !q || p.name.toLowerCase().includes(q)),
    [products, q],
  );
  const filteredServices = useMemo(
    () => services.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [services, q],
  );

  const total = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  // El saldo puede ser menor que la venta: cubre lo que alcanza y el resto se
  // cobra con el método elegido. El server recalcula igual con el saldo real.
  const covered = card ? Math.min(card.balance, total) : 0;
  const remainder = total - covered;

  async function applyCard() {
    const code = cardCode.trim();
    if (code.length < 4) return;
    setCheckingCard(true);
    try {
      const res = await fetch(`/api/giftcards/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo buscar");
      const found = data.giftCard as { code: string; balance: number; status: string; expiresAt: string | null };
      if (found.status === "CANCELLED") throw new Error("Esta giftcard fue anulada");
      if (found.status === "REDEEMED" || found.balance <= 0) throw new Error("Esta giftcard ya no tiene saldo");
      if (found.expiresAt && new Date(found.expiresAt) < new Date()) throw new Error("Esta giftcard está vencida");
      setCard({ code: found.code, balance: found.balance });
      setCardCode("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCheckingCard(false);
    }
  }

  function addLine(kind: "product" | "service", opt: ProductOpt | ServiceOpt) {
    setCart((prev) => {
      const existing = prev.find((l) => l.key === opt.id);
      const maxQty = kind === "product" ? (opt as ProductOpt).stock : undefined;
      if (existing) {
        if (maxQty !== undefined && existing.qty >= maxQty) {
          toast.error(`Solo quedan ${maxQty} de ${opt.name}`);
          return prev;
        }
        return prev.map((l) => (l.key === opt.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (maxQty !== undefined && maxQty < 1) {
        toast.error(`${opt.name} está sin stock`);
        return prev;
      }
      return [...prev, { key: opt.id, kind, name: opt.name, unitPrice: opt.price, qty: 1, maxQty }];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          const qty = l.qty + delta;
          if (l.maxQty !== undefined && qty > l.maxQty) {
            toast.error(`Solo quedan ${l.maxQty} de ${l.name}`);
            return l;
          }
          return { ...l, qty };
        })
        .filter((l) => l.qty > 0),
    );
  }

  async function submit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) =>
            l.kind === "product"
              ? { productId: l.key, qty: l.qty }
              : { serviceId: l.key, qty: l.qty },
          ),
          paymentMethod: method,
          barberId: barberId || undefined,
          giftCardCode: card?.code,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo registrar");
      toast.success(
        covered > 0
          ? `Venta registrada — ${formatCLP(covered)} con giftcard${remainder > 0 ? ` y ${formatCLP(remainder)} en ${METHOD_LABEL[method]}` : ""}`
          : `Venta registrada — ${formatCLP(total)}`,
      );
      setCart([]);
      setBarberId("");
      setCard(null);
      setCardCode("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelSale(sale: SaleRow) {
    const ok = await confirm({
      title: "¿Anular esta venta?",
      description: `${formatCLP(sale.total)} en ${METHOD_LABEL[sale.paymentMethod]}. El stock de los productos vuelve al inventario.`,
      confirmText: "Anular venta",
      destructive: true,
    });
    if (!ok) return;
    setBusySale(sale.id);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo anular");
      toast.success("Venta anulada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusySale(null);
    }
  }

  const activeSales = initialSales.filter((s) => !s.cancelledAt);
  // El total del día es el dinero que entró hoy: lo pagado con giftcard se
  // muestra aparte porque ya ingresó cuando se vendió la giftcard.
  const dayTotal = activeSales.reduce((s, v) => s + v.total - v.giftCardAmount, 0);
  const dayGiftCard = activeSales.reduce((s, v) => s + v.giftCardAmount, 0);
  const byMethod = METHODS.map((m) => ({
    ...m,
    total: activeSales
      .filter((s) => s.paymentMethod === m.key)
      .reduce((s, v) => s + v.total - v.giftCardAmount, 0),
  })).filter((m) => m.total > 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
      {/* Venta rápida */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <div className="flex rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setTab("product")}
                aria-pressed={tab === "product"}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                  tab === "product" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Package className="h-3.5 w-3.5" />
                Productos
              </button>
              <button
                type="button"
                onClick={() => setTab("service")}
                aria-pressed={tab === "service"}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                  tab === "service" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Scissors className="h-3.5 w-3.5" />
                Servicios
              </button>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-9 flex-1"
              aria-label="Buscar en el catálogo"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {tab === "product" ? (
              filteredProducts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {products.length === 0
                    ? "Sin productos aún — créalos en la sección Productos."
                    : "Nada coincide con la búsqueda."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addLine("product", p)}
                        disabled={p.stock < 1}
                        className="flex w-full items-center justify-between gap-3 rounded px-3 py-2.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span
                            className={cn(
                              "text-xs",
                              p.stock < 1 ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {p.stock < 1 ? "Sin stock" : `Stock: ${p.stock}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatCLP(p.price)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : filteredServices.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nada coincide con la búsqueda.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredServices.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => addLine("service", s)}
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-2.5 text-left hover:bg-muted"
                    >
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatCLP(s.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Carrito */}
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <ShoppingCart className="h-4 w-4" />
            Venta actual
          </h2>
          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Toca un producto o servicio para agregarlo.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {cart.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatCLP(l.unitPrice)} c/u
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => changeQty(l.key, -1)}>
                      <Minus className="h-3.5 w-3.5" />
                      <span className="sr-only">Quitar uno</span>
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => changeQty(l.key, 1)}>
                      <Plus className="h-3.5 w-3.5" />
                      <span className="sr-only">Agregar uno</span>
                    </Button>
                  </div>
                  <span className="w-20 text-right text-sm font-medium tabular-nums">
                    {formatCLP(l.unitPrice * l.qty)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setCart((prev) => prev.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Eliminar línea</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {cart.length > 0 && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {giftCardsEnabled && (
                <div className="space-y-1.5">
                  <Label htmlFor="sale-giftcard">Giftcard (opcional)</Label>
                  {card ? (
                    <div className="flex items-center gap-2 rounded-md border border-accent bg-accent/15 px-3 py-2 text-sm">
                      <Gift className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium tabular-nums">{card.code}</span>
                        <span className="ml-2 text-muted-foreground tabular-nums">
                          saldo {formatCLP(card.balance)}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0"
                        onClick={() => setCard(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="sr-only">Quitar giftcard {card.code}</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="sale-giftcard"
                        value={cardCode}
                        onChange={(e) => setCardCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void applyCard();
                          }
                        }}
                        placeholder="NVX-XXXXXX"
                        autoComplete="off"
                        className="flex-1 uppercase"
                      />
                      <Button
                        variant="outline"
                        onClick={applyCard}
                        loading={checkingCard}
                        disabled={cardCode.trim().length < 4}
                      >
                        Aplicar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={cn("space-y-1.5", remainder === 0 && "opacity-50")}>
                  <Label>
                    {covered > 0 ? "Método del resto" : "Método de pago"}
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {METHODS.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMethod(m.key)}
                        aria-pressed={method === m.key}
                        disabled={remainder === 0}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed",
                          method === m.key
                            ? "border-accent bg-accent/15"
                            : "border-input text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <m.icon className="h-3.5 w-3.5" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {barbers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-barber">Vendedor (opcional)</Label>
                    <NativeSelect
                      id="sale-barber"
                      value={barberId}
                      onChange={(e) => setBarberId(e.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {barbers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums tracking-tight",
                      covered > 0 ? "text-base" : "text-2xl",
                    )}
                  >
                    {formatCLP(total)}
                  </span>
                </div>
                {covered > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Giftcard {card!.code}</span>
                      <span className="tabular-nums">−{formatCLP(covered)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-1">
                      <span className="text-sm text-muted-foreground">
                        {remainder === 0 ? "Nada por cobrar" : "Por cobrar"}
                      </span>
                      <span className="text-2xl font-medium tabular-nums tracking-tight">
                        {formatCLP(remainder)}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                {remainder === 0 && covered > 0
                  ? `Cobrar con giftcard (${formatCLP(covered)})`
                  : `Cobrar ${formatCLP(remainder)}`}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Resumen del día */}
      <Card className="self-start overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Hoy</h2>
            <span className="text-xl font-medium tabular-nums tracking-tight">
              {formatCLP(dayTotal)}
            </span>
          </div>
          {(byMethod.length > 0 || dayGiftCard > 0) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {byMethod.map((m) => (
                <span
                  key={m.key}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums"
                >
                  <m.icon className="h-3 w-3" />
                  {m.label}: {formatCLP(m.total)}
                </span>
              ))}
              {dayGiftCard > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground"
                  title="Ya ingresó al vender la giftcard: no suma al total del día"
                >
                  <Gift className="h-3 w-3" />
                  Giftcard: {formatCLP(dayGiftCard)}
                </span>
              )}
            </div>
          )}
        </div>

        {initialSales.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Sin ventas hoy. La primera aparecerá aquí.
          </p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
            {initialSales.map((s) => (
              <li
                key={s.id}
                className={cn("flex items-start gap-3 px-4 py-3", s.cancelledAt && "opacity-50")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium tabular-nums">{formatTime(new Date(s.createdAt))}</span>
                    <Badge variant="outline" className="text-xs">
                      {METHOD_LABEL[s.paymentMethod]}
                    </Badge>
                    {s.kind === "APPOINTMENT_BALANCE" && (
                      <Badge variant="outline" className="text-xs">
                        Saldo de cita
                      </Badge>
                    )}
                    {s.giftCardAmount > 0 && s.paymentMethod !== "GIFTCARD" && (
                      <Badge variant="outline" className="text-xs">
                        + giftcard {formatCLP(s.giftCardAmount)}
                      </Badge>
                    )}
                    {s.cancelledAt && (
                      <Badge variant="destructive" className="text-xs">
                        Anulada
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(", ")}
                    {s.clientName ? ` · ${s.clientName}` : ""}
                    {s.giftCardCode ? ` · ${s.giftCardCode}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      s.cancelledAt && "line-through",
                    )}
                  >
                    {formatCLP(s.total)}
                  </span>
                  {isManager && !s.cancelledAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => cancelSale(s)}
                      disabled={busySale === s.id}
                      title="Anular venta"
                    >
                      {busySale === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" />
                      )}
                      <span className="sr-only">Anular venta de {formatCLP(s.total)}</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirmDialog}
    </div>
  );
}
