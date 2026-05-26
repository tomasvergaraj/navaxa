"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, Card, Textarea } from "@navaxa/ui";
import { toast } from "sonner";
import { StarRating } from "@/components/ui/star-rating";

type Props = {
  token: string;
  shopName: string;
  barberName: string;
  firstName: string;
  initialRating: number;
  initialComment: string;
};

export function ReviewForm({ token, shopName, barberName, firstName, initialRating, initialComment }: Props) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!rating) {
      toast.error("Elige una calificación");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/public/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo enviar");
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent" />
        <h2 className="mt-4 font-display text-xl font-medium">¡Gracias, {firstName}!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu reseña ayuda a {shopName} y a más clientes a elegir bien.
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => setDone(false)}>
          Editar mi reseña
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-medium">¿Cómo te fue?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tu visita a {shopName} con {barberName}.
      </p>

      <div className="mt-5 flex justify-center">
        <StarRating value={rating} onChange={setRating} />
      </div>

      <div className="mt-5 space-y-1.5">
        <Textarea
          rows={4}
          maxLength={500}
          placeholder="Cuéntanos cómo fue tu experiencia (opcional)…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <Button className="mt-4 w-full" onClick={submit} disabled={saving || !rating}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar reseña
      </Button>
    </Card>
  );
}
