"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Input, Label, Textarea, Card } from "@navaxa/ui";
import { toast } from "sonner";
import { BarberAvatar } from "@/components/barbers/barber-avatar";
import { TagsInput } from "@/components/ui/tags-input";

type Props = {
  barberId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string;
  specialties: string[];
  instagram: string;
  commissionPct: number;
};

export function BarberProfileForm(props: Props) {
  const router = useRouter();
  const [bio, setBio] = useState(props.bio);
  const [specialties, setSpecialties] = useState<string[]>(props.specialties);
  const [instagram, setInstagram] = useState(props.instagram);
  const [saving, setSaving] = useState(false);

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
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center gap-4">
        <BarberAvatar barberId={props.barberId} avatarUrl={props.avatarUrl} name={props.name} />
        <div className="min-w-0">
          <h2 className="truncate font-medium">{props.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{props.email}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-bio">Descripción</Label>
        <Textarea
          id="p-bio"
          rows={3}
          placeholder="Cuéntales a tus clientes tu estilo y experiencia…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-spec">Especialidades</Label>
        <TagsInput
          id="p-spec"
          value={specialties}
          onChange={setSpecialties}
          placeholder="fade, barba, color… (Enter para agregar)"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-ig">Instagram</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">@</span>
          <Input
            id="p-ig"
            value={instagram}
            placeholder="tu_usuario"
            onChange={(e) => setInstagram(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-comm">Comisión</Label>
        <Input id="p-comm" value={`${props.commissionPct}%`} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          La comisión la define el dueño de la barbería.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </Card>
  );
}
