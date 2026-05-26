"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Textarea,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@navaxa/ui";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UploadPhotoDialogProps {
  clientId: string;
  barbers: { id: string; name: string }[];
}

export function UploadPhotoDialog({ clientId, barbers }: UploadPhotoDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<string>("5");
  const [barberId, setBarberId] = useState<string>("");

  const reset = () => {
    setFile(null);
    setStyle("");
    setNotes("");
    setRating("5");
    setBarberId("");
  };

  const submit = async () => {
    if (!file) {
      toast.error("Selecciona una foto");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (style) fd.set("style", style);
      if (notes) fd.set("notes", notes);
      if (rating) fd.set("rating", rating);
      if (barberId) fd.set("barberId", barberId);
      const res = await fetch(`/api/clients/${clientId}/photos`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error subiendo foto");
      toast.success("Foto agregada al historial");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Camera className="h-4 w-4" />
          Agregar foto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva foto de corte</DialogTitle>
          <DialogDescription>
            Sube la foto del corte recién realizado para agregarlo al historial visual del cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Foto</Label>
            <Input
              id="file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="style">Estilo</Label>
            <Input
              id="style"
              placeholder="Ej: fade medio, undercut, pompadour"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Barbero</Label>
              <Select value={barberId} onValueChange={setBarberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {"★".repeat(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones del corte"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading || !file}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
