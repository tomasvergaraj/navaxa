"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { Button, Card, Textarea, Label } from "@navaxa/ui";
import { toast } from "sonner";
import { StarRating } from "@/components/ui/star-rating";
import { GoogleIcon } from "@/components/ui/google-icon";

type Props = {
  token: string;
  shopName: string;
  barberName: string;
  firstName: string;
  initialRating: number;
  initialComment: string;
  /** Deep link al diálogo de reseña de Google (null si el local no está vinculado). */
  googleReviewUrl: string | null;
};

export function ReviewForm({
  token,
  shopName,
  barberName,
  firstName,
  initialRating,
  initialComment,
  googleReviewUrl,
}: Props) {
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

  async function copyComment() {
    await navigator.clipboard.writeText(comment.trim());
    toast.success("Comentario copiado — pégalo en Google");
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent" />
        <h2 className="mt-4 font-display text-xl font-medium">¡Gracias, {firstName}!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu reseña ayuda a {shopName} y a más clientes a elegir bien.
        </p>

        {googleReviewUrl && (
          <div className="mt-6 w-full rounded-md border border-border p-4">
            <p className="text-sm font-medium">¿Nos ayudas también en Google?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Una reseña pública ayuda a que más personas encuentren a {shopName}.
            </p>
            <Button asChild variant="outline" className="mt-3 w-full">
              <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer">
                <GoogleIcon className="h-4 w-4" />
                Dejar reseña en Google
              </a>
            </Button>
            {comment.trim() && (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={copyComment}>
                <Copy className="h-3.5 w-3.5" />
                Copiar mi comentario
              </Button>
            )}
          </div>
        )}

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

      <div className="mt-5 space-y-1.5 text-left">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="rv-comment">Tu comentario (opcional)</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{comment.length}/500</span>
        </div>
        <Textarea
          id="rv-comment"
          rows={4}
          maxLength={500}
          placeholder="Cuéntanos cómo fue tu experiencia…"
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
