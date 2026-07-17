"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Pencil, Trash2, Loader2, PackagePlus, AlertTriangle } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
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

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number | null;
  stock: number;
  minStock: number;
  active: boolean;
}

async function apiJson(path: string, init: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
  return data;
}

const emptyForm = { name: "", price: "", cost: "", minStock: "0" };

export function ProductsManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  // Diálogo crear/editar
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Diálogo de stock
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [movement, setMovement] = useState({ qty: "1", direction: "in", reason: "PURCHASE", note: "" });
  const [moving, setMoving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const lowStock = products.filter((p) => p.active && p.minStock > 0 && p.stock <= p.minStock);

  function openCreate() {
    setForm(emptyForm);
    setEditing("new");
  }
  function openEdit(p: Product) {
    setForm({
      name: p.name,
      price: String(p.price),
      cost: p.cost === null ? "" : String(p.cost),
      minStock: String(p.minStock),
    });
    setEditing(p);
  }

  async function save() {
    const body = {
      name: form.name,
      price: Number(form.price),
      cost: form.cost === "" ? null : Number(form.cost),
      minStock: Number(form.minStock) || 0,
    };
    if (!body.name.trim() || Number.isNaN(body.price)) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await apiJson("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast.success("Producto creado");
      } else if (editing) {
        await apiJson(`/api/products/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast.success("Producto actualizado");
      }
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    setBusyId(p.id);
    try {
      await apiJson(`/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: Product) {
    const ok = await confirm({
      title: `¿Eliminar ${p.name}?`,
      description:
        "Si el producto tiene ventas o movimientos registrados, se desactiva en vez de borrarse (el historial se conserva).",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      const r = await apiJson(`/api/products/${p.id}`, { method: "DELETE" });
      toast.success(r.deactivated ? "Producto desactivado (tenía historial)" : "Producto eliminado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function applyMovement() {
    if (!stockFor) return;
    const qty = Number(movement.qty);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error("Cantidad inválida");
      return;
    }
    const delta = movement.direction === "in" ? qty : -qty;
    setMoving(true);
    try {
      await apiJson(`/api/products/${stockFor.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delta,
          reason: movement.direction === "in" ? movement.reason : "ADJUSTMENT",
          note: movement.note || undefined,
        }),
      });
      toast.success("Stock actualizado");
      setStockFor(null);
      setMovement({ qty: "1", direction: "in", reason: "PURCHASE", note: "" });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div
          className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          role="status"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            <strong>{lowStock.length}</strong> producto{lowStock.length === 1 ? "" : "s"} en o bajo
            su stock mínimo: {lowStock.map((p) => p.name).join(", ")}.
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no registras productos"
          description="Agrega ceras, shampoo, aceites o accesorios para venderlos desde la Caja con control de stock."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Agregar el primero
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Producto</th>
                  <th className="px-4 py-3 text-right font-medium">Precio</th>
                  <th className="px-4 py-3 text-right font-medium">Costo</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const low = p.active && p.minStock > 0 && p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCLP(p.price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {p.cost === null ? "—" : formatCLP(p.cost)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          {low && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                              aria-label="Stock bajo"
                            />
                          )}
                          {p.stock}
                          {p.minStock > 0 && (
                            <span className="text-xs text-muted-foreground">/ mín {p.minStock}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleActive(p)}
                          disabled={busyId === p.id}
                          title={p.active ? "Clic para desactivar" : "Clic para activar"}
                          className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                          <Badge variant={p.active ? "success" : "outline"}>
                            {p.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStockFor(p)}
                            title="Entrada o ajuste de stock"
                          >
                            <PackagePlus className="h-4 w-4" />
                            <span className="sr-only">Stock de {p.name}</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar {p.name}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(p)}
                            disabled={busyId === p.id}
                          >
                            {busyId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            <span className="sr-only">Eliminar {p.name}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Crear / editar */}
      <Dialog open={editing !== null} onOpenChange={(o) => !saving && !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nuevo producto" : "Editar producto"}</DialogTitle>
            <DialogDescription>
              El stock se maneja aparte, con entradas y ajustes que quedan en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nombre</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Cera mate 100 g"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-price">Precio de venta (CLP)</Label>
                <Input
                  id="p-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="8990"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cost">Costo (opcional)</Label>
                <Input
                  id="p-cost"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  placeholder="4500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-min">Alerta de stock mínimo</Label>
              <Input
                id="p-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.minStock}
                onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Te avisamos cuando el stock llegue a este número (0 = sin alerta).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entrada / ajuste de stock */}
      <Dialog open={stockFor !== null} onOpenChange={(o) => !moving && !o && setStockFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Stock: {stockFor?.name}</DialogTitle>
            <DialogDescription>
              Actual: <strong className="tabular-nums">{stockFor?.stock}</strong> unidad(es).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-dir">Movimiento</Label>
                <NativeSelect
                  id="m-dir"
                  value={movement.direction}
                  onChange={(e) => setMovement((m) => ({ ...m, direction: e.target.value }))}
                >
                  <option value="in">Entrada (+)</option>
                  <option value="out">Salida / merma (−)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-qty">Cantidad</Label>
                <Input
                  id="m-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={movement.qty}
                  onChange={(e) => setMovement((m) => ({ ...m, qty: e.target.value }))}
                />
              </div>
            </div>
            {movement.direction === "in" && (
              <div className="space-y-1.5">
                <Label htmlFor="m-reason">Motivo</Label>
                <NativeSelect
                  id="m-reason"
                  value={movement.reason}
                  onChange={(e) => setMovement((m) => ({ ...m, reason: e.target.value }))}
                >
                  <option value="PURCHASE">Compra de mercadería</option>
                  <option value="ADJUSTMENT">Corrección de inventario</option>
                </NativeSelect>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="m-note">Nota (opcional)</Label>
              <Input
                id="m-note"
                value={movement.note}
                onChange={(e) => setMovement((m) => ({ ...m, note: e.target.value }))}
                placeholder="Factura #123, proveedor…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStockFor(null)} disabled={moving}>
              Cancelar
            </Button>
            <Button onClick={applyMovement} disabled={moving}>
              {moving && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
