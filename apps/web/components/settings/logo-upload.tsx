"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Button } from "@navaxa/ui";
import { toast } from "sonner";

export function LogoUpload({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se aceptan imágenes");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Máximo 4 MB");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tenant/logo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo subir");
      toast.success("Logo actualizado");
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
      const res = await fetch("/api/tenant/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo quitar");
      toast.success("Logo eliminado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 shrink-0">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="h-16 w-16 rounded-full border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 font-display text-2xl font-medium text-foreground">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {logoUrl ? "Cambiar" : "Subir logo"}
          </Button>
          {logoUrl && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2 className="h-4 w-4 text-destructive" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG o JPG, máx. 4 MB. Se ve en tu página de reservas.</p>
      </div>

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
