"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@navaxa/ui";
import { toast } from "sonner";
import { TagsInput } from "@/components/ui/tags-input";

type Preferences = {
  hairType?: string | null;
  preferredStyle?: string | null;
  fadeType?: string | null;
  topLength?: string | null;
  beardStyle?: string | null;
  allergies?: string | null;
  notes?: string | null;
  preferredBarberId?: string | null;
};

type Props = {
  clientId: string;
  initial: {
    tags: string[];
    notes: string;
    preferences: Preferences | null;
  };
  barbers: { id: string; name: string }[];
};

const HAIR_TYPES = [
  { value: "straight", label: "Lacio" },
  { value: "wavy", label: "Ondulado" },
  { value: "curly", label: "Rizado" },
  { value: "coily", label: "Crespo" },
];
const FADE_TYPES = [
  { value: "low", label: "Low" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
  { value: "skin", label: "Skin" },
  { value: "taper", label: "Taper" },
  { value: "none", label: "Sin fade" },
];
const TOP_LENGTHS = [
  { value: "short", label: "Corto" },
  { value: "medium", label: "Medio" },
  { value: "long", label: "Largo" },
];

const UNSET = "__unset__";

export function EditClientDialog({ clientId, initial, barbers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tags, setTags] = useState<string[]>(initial.tags);
  const [notes, setNotes] = useState(initial.notes);

  const p = initial.preferences ?? {};
  const [hairType, setHairType] = useState<string>(p.hairType ?? "");
  const [preferredStyle, setPreferredStyle] = useState<string>(p.preferredStyle ?? "");
  const [fadeType, setFadeType] = useState<string>(p.fadeType ?? "");
  const [topLength, setTopLength] = useState<string>(p.topLength ?? "");
  const [beardStyle, setBeardStyle] = useState<string>(p.beardStyle ?? "");
  const [allergies, setAllergies] = useState<string>(p.allergies ?? "");
  const [prefNotes, setPrefNotes] = useState<string>(p.notes ?? "");
  const [preferredBarberId, setPreferredBarberId] = useState<string>(p.preferredBarberId ?? "");

  function reset() {
    setTags(initial.tags);
    setNotes(initial.notes);
    const pp = initial.preferences ?? {};
    setHairType(pp.hairType ?? "");
    setPreferredStyle(pp.preferredStyle ?? "");
    setFadeType(pp.fadeType ?? "");
    setTopLength(pp.topLength ?? "");
    setBeardStyle(pp.beardStyle ?? "");
    setAllergies(pp.allergies ?? "");
    setPrefNotes(pp.notes ?? "");
    setPreferredBarberId(pp.preferredBarberId ?? "");
  }

  async function save() {
    setSaving(true);
    try {
      // null = "limpiar este campo en la BD"; undefined nunca, porque el
      // dialog siempre conoce el valor actual.
      const norm = (v: string) => (v.trim() === "" ? null : v.trim());
      const preferences = {
        hairType: hairType || null,
        preferredStyle: norm(preferredStyle),
        fadeType: fadeType || null,
        topLength: topLength || null,
        beardStyle: norm(beardStyle),
        allergies: norm(allergies),
        notes: norm(prefNotes),
        preferredBarberId: preferredBarberId || null,
      };
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { tags, notes: notes.trim() },
          preferences,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success("Cliente actualizado");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Pencil className="h-4 w-4" />
        Editar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>
              Etiquetas y preferencias de corte. Esto guía las recomendaciones y
              el historial visual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section className="space-y-1.5">
              <Label htmlFor="ec-tags">Etiquetas</Label>
              <TagsInput
                id="ec-tags"
                value={tags}
                onChange={setTags}
                placeholder="vip, novio, sensible al ruido… (Enter para agregar)"
              />
              <p className="text-xs text-muted-foreground">
                Banderas rápidas que vas a ver en la ficha y la agenda.
              </p>
            </section>

            <section className="space-y-1.5">
              <Label htmlFor="ec-notes">Notas generales</Label>
              <Textarea
                id="ec-notes"
                rows={2}
                placeholder="Contexto que no calza en preferencias…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </section>

            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium">Preferencias de corte</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de pelo</Label>
                  <PrefSelect
                    value={hairType}
                    onChange={setHairType}
                    options={HAIR_TYPES}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fade</Label>
                  <PrefSelect
                    value={fadeType}
                    onChange={setFadeType}
                    options={FADE_TYPES}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Largo arriba</Label>
                  <PrefSelect
                    value={topLength}
                    onChange={setTopLength}
                    options={TOP_LENGTHS}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Barbero preferido</Label>
                  <PrefSelect
                    value={preferredBarberId}
                    onChange={setPreferredBarberId}
                    options={barbers.map((b) => ({ value: b.id, label: b.name }))}
                    placeholder="—"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ec-style">Estilo preferido</Label>
                  <Input
                    id="ec-style"
                    placeholder="Ej: fade medio + textura arriba"
                    value={preferredStyle}
                    onChange={(e) => setPreferredStyle(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ec-beard">Barba</Label>
                  <Input
                    id="ec-beard"
                    placeholder="Ej: contornada con navaja"
                    value={beardStyle}
                    onChange={(e) => setBeardStyle(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ec-allerg">Alergias</Label>
                  <Input
                    id="ec-allerg"
                    placeholder="Ej: alcohol, fragancia X"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ec-pnotes">Notas de preferencia</Label>
                  <Textarea
                    id="ec-pnotes"
                    rows={2}
                    placeholder="Detalles técnicos del corte"
                    value={prefNotes}
                    onChange={(e) => setPrefNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrefSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  // El Select de Radix no acepta value="" (lo trata como "sin valor"), así que
  // mapeamos vacío ↔ sentinel para incluir una opción de limpieza.
  return (
    <Select
      value={value || UNSET}
      onValueChange={(v) => onChange(v === UNSET ? "" : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
