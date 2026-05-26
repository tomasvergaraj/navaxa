"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@navaxa/ui";
import { toast } from "sonner";

export function HideReviewButton({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !hidden }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo actualizar");
      toast.success(hidden ? "Reseña visible" : "Reseña oculta");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={loading} className="shrink-0">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hidden ? (
        <Eye className="h-4 w-4" />
      ) : (
        <EyeOff className="h-4 w-4" />
      )}
      {hidden ? "Mostrar" : "Ocultar"}
    </Button>
  );
}
