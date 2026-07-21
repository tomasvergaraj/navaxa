"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatDateShort } from "@/lib/format";

export interface HaircutPhoto {
  id: string;
  imageUrl: string;
  style: string | null;
  performedAt: Date | string;
  rating: number | null;
}

/**
 * Historial visual del cliente. Es client component solo por el borrado: la
 * galería es el único recurso que acumula archivos en storage y cuenta contra el
 * tope del plan, así que necesita una salida.
 */
export function HaircutGallery({
  clientId,
  photos,
}: {
  clientId: string;
  photos: HaircutPhoto[];
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(photo: HaircutPhoto) {
    const ok = await confirm({
      title: "¿Eliminar esta foto?",
      description: "Se borra del historial y del almacenamiento. No se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(photo.id);
    try {
      const res = await fetch(`/api/clients/${clientId}/photos/${photo.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo eliminar la foto");
      }
      toast.success("Foto eliminada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        Aún no hay fotos de cortes registradas para este cliente.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((h) => (
          <figure
            key={h.id}
            className="group relative overflow-hidden rounded-lg border border-border bg-muted/20"
          >
            <div className="relative aspect-square">
              <Image
                src={h.imageUrl}
                alt={h.style ?? "Corte"}
                fill
                sizes="(max-width: 640px) 50vw, 220px"
                className="object-cover transition group-hover:scale-105"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(h)}
              disabled={busyId === h.id}
              aria-label="Eliminar foto"
              // Siempre visible en touch (no hay hover); en escritorio aparece al pasar.
              className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-100 transition hover:bg-rose-600 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              {busyId === h.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 text-xs text-white">
              <div className="font-medium">{h.style ?? "Sin estilo"}</div>
              <div className="opacity-80">{formatDateShort(h.performedAt)}</div>
              {h.rating && (
                <div className="mt-1 tracking-wider text-amber-300">
                  {"★".repeat(h.rating)}
                  <span className="opacity-30">{"★".repeat(5 - h.rating)}</span>
                </div>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {confirmDialog}
    </>
  );
}
