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
import { Camera, Loader2, Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface UploadPhotoDialogProps {
  clientId: string;
  clientPhone?: string | null;
  barbers: { id: string; name: string }[];
}

export function UploadPhotoDialog({ clientId, clientPhone, barbers }: UploadPhotoDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState("");
  const [notes, setNotes] = useState("");
  const [barberId, setBarberId] = useState<string>("");
  const [ratingUrl, setRatingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setFile(null);
    setStyle("");
    setNotes("");
    setBarberId("");
    setRatingUrl(null);
    setCopied(false);
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
      if (barberId) fd.set("barberId", barberId);
      const res = await fetch(`/api/clients/${clientId}/photos`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error subiendo foto");
      toast.success("Foto agregada al historial");
      setRatingUrl(json.ratingUrl ?? null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!ratingUrl) return;
    await navigator.clipboard.writeText(ratingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const whatsappHref = ratingUrl
    ? `https://wa.me/${clientPhone ? clientPhone.replace(/[^\d]/g, "") : ""}?text=${encodeURIComponent(
        `¡Gracias por venir! ¿Cómo te quedó el corte? Califícalo aquí: ${ratingUrl}`,
      )}`
    : null;

  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Camera className="h-4 w-4" />
          Agregar foto
        </Button>
      </DialogTrigger>
      <DialogContent>
        {ratingUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Pídele el rating al cliente</DialogTitle>
              <DialogDescription>
                Pásale este link o muéstrale el QR en el celular. Un toque y listo —
                la reseña general se le pide aparte.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={ratingUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {whatsappHref && (
                <Button asChild className="w-full" variant="outline">
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    {clientPhone ? "Enviar por WhatsApp" : "Abrir WhatsApp"}
                  </a>
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button onClick={close}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nueva foto de corte</DialogTitle>
              <DialogDescription>
                Sube la foto recién hecha. Al guardar generamos un link para que el
                cliente le ponga estrellas con un toque.
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
              <Button variant="ghost" onClick={close} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={loading || !file}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar foto
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
