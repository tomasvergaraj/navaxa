"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@navaxa/ui";
import { toast } from "sonner";
import { TagsInput } from "@/components/ui/tags-input";

type Props = {
  barberId: string;
  name: string;
  bio: string;
  specialties: string[];
  instagram: string;
};

export function EditBarberButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bio, setBio] = useState(props.bio);
  const [specialties, setSpecialties] = useState<string[]>(props.specialties);
  const [instagram, setInstagram] = useState(props.instagram);
  const [saving, setSaving] = useState(false);

  function openDialog() {
    // Reset a los valores actuales por si cambiaron desde el último render.
    setBio(props.bio);
    setSpecialties(props.specialties);
    setInstagram(props.instagram);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/barbers/${props.barberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim(),
          specialties,
          instagram: instagram.trim().replace(/^@/, ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success("Perfil actualizado");
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
        variant="ghost"
        size="icon"
        onClick={openDialog}
        aria-label="Editar perfil"
        className="h-8 w-8 shrink-0"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil de {props.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="eb-bio">Descripción</Label>
              <Textarea
                id="eb-bio"
                rows={3}
                placeholder="Especialidad, estilo, experiencia…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eb-spec">Especialidades</Label>
              <TagsInput
                id="eb-spec"
                value={specialties}
                onChange={setSpecialties}
                placeholder="fade, barba, color… (Enter para agregar)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eb-ig">Instagram</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">@</span>
                <Input
                  id="eb-ig"
                  value={instagram}
                  placeholder="usuario"
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              La comisión y el rol se editan en Configuración → Equipo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
