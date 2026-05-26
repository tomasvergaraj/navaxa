"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@navaxa/ui";
import { toast } from "sonner";

export function CoverUpload({ coverUrl }: { coverUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Solo se aceptan imágenes");
    if (file.size > 6 * 1024 * 1024) return toast.error("Máximo 6 MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tenant/cover", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo subir");
      toast.success("Portada actualizada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/cover", { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo quitar");
      toast.success("Portada eliminada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg border border-border bg-muted">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Portada" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent/10 text-sm text-muted-foreground">
            Sin portada
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
          {coverUrl ? "Cambiar portada" : "Subir portada"}
        </Button>
        {coverUrl && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
            <Trash2 className="h-4 w-4 text-destructive" />
            Quitar
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Banner superior de tu página de reservas. JPG/PNG, máx. 6 MB.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
