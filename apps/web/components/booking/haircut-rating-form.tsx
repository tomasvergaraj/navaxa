"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "@/components/ui/star-rating";

type Props = {
  token: string;
  firstName: string;
  barberName: string | null;
  style: string | null;
  initialRating: number;
};

/**
 * "Un toque y listo": al elegir estrellas, dispara el POST de inmediato.
 * Sin botón de envío, sin campo de texto — la reseña general se pide aparte.
 */
export function HaircutRatingForm({ token, firstName, barberName, style, initialRating }: Props) {
  const [rating, setRating] = useState(initialRating);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(initialRating > 0);

  async function submit(value: number) {
    setRating(value);
    setSaving(true);
    try {
      const res = await fetch(`/api/public/haircut-rating/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message);
      setRating(initialRating);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent" />
        <h2 className="mt-4 font-display text-xl font-medium">¡Gracias, {firstName}!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu valoración quedó guardada
          {barberName ? ` para ${barberName}` : ""}.
        </p>
        <div className="mt-4 flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={i <= rating ? "text-accent" : "text-muted-foreground/30"}
            >
              ★
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Cambiar mi valoración
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <h2 className="font-display text-xl font-medium">¿Cómo te quedó el corte?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Hola {firstName}
        {barberName ? `, ${barberName} te atendió` : ""}
        {style ? ` · ${style}` : ""}.
      </p>
      <div className="mt-6 flex justify-center">
        <StarRating value={rating} onChange={submit} disabled={saving} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Guardando…
          </span>
        ) : (
          "Un toque y listo."
        )}
      </p>
    </div>
  );
}
