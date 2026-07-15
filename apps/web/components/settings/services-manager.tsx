"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
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
import { formatCLP, formatDuration } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  category: string | null;
  color: string | null;
}

const empty = { name: "", description: "", price: "", durationMin: "30", category: "", color: "" };

export function ServicesManager({ services }: { services: Service[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) if (s.category) set.add(s.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [services]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setCreatingCategory(false);
    setOpen(true);
  }
  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: String(s.price),
      durationMin: String(s.durationMin),
      category: s.category ?? "",
      color: s.color ?? "",
    });
    setCreatingCategory(false);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        durationMin: Number(form.durationMin),
        category: form.category || undefined,
        color: form.color || undefined,
      };
      const res = await fetch(editing ? `/api/services/${editing.id}` : "/api/services", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success(editing ? "Servicio actualizado" : "Servicio creado");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Service) {
    const ok = await confirm({
      title: "Eliminar servicio",
      description: `¿Eliminar "${s.name}"? Dejará de ofrecerse a los clientes.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(s.id);
    try {
      const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast.success("Servicio eliminado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const valid = form.name.trim() && Number(form.price) >= 0 && Number(form.durationMin) >= 5;

  return (
    <>
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-medium">Servicios ({services.length})</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            La duración define cuánto bloquea la agenda y las horas disponibles online.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>

<div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Servicio</th>
            <th className="px-4 py-3 text-left font-medium">Duración</th>
            <th className="px-4 py-3 text-right font-medium">Precio</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {services.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                Aún no tienes servicios. Agrega el primero.
              </td>
            </tr>
          )}
          {services.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {s.color && (
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  )}
                  <span className="font-medium">{s.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDuration(s.durationMin)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCLP(s.price)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(s)}
                    disabled={deletingId === s.id}
                    aria-label="Eliminar"
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
            <DialogDescription className="sr-only">Crea o edita un servicio del catálogo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Nombre</Label>
              <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-price">Precio (CLP)</Label>
                <Input
                  id="s-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-dur">Duración (min)</Label>
                <Input
                  id="s-dur"
                  type="number"
                  min={5}
                  step={5}
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-cat">Categoría</Label>
                <NativeSelect
                  id="s-cat"
                  value={creatingCategory ? "__new__" : form.category}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setCreatingCategory(true);
                      setForm({ ...form, category: "" });
                    } else {
                      setCreatingCategory(false);
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__new__">+ Crear categoría…</option>
                </NativeSelect>
                {creatingCategory && (
                  <Input
                    autoFocus
                    placeholder="Nombre de la categoría"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-color">Color</Label>
                <Input
                  id="s-color"
                  type="color"
                  value={form.color || "#888888"}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 p-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-desc">Descripción (opcional)</Label>
              <Textarea
                id="s-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !valid}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
