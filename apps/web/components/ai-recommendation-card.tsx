"use client";

import { useState } from "react";
import { Button, Badge } from "@navaxa/ui";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  suggestedStyle: string;
  reasoning: string;
  fadeType: string;
  topLength: string;
  alternatives: { name: string; reason: string }[];
  warnings: string[];
}

export function AIRecommendationCard({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error generando recomendación");
      setData(json.recommendation);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-gradient-to-br from-amber-50/40 to-transparent p-5 dark:from-amber-950/20">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-medium">Próximo corte sugerido</h3>
      </div>

      {!data && !loading && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Genera una sugerencia basada en el historial visual y preferencias del cliente.
          </p>
          <Button size="sm" variant="outline" onClick={generate}>
            <Sparkles className="h-3.5 w-3.5" />
            Generar sugerencia
          </Button>
        </>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analizando historial…
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div>
            <div className="text-base font-medium">{data.suggestedStyle}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.reasoning}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              Fade: {data.fadeType}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Largo: {data.topLength}
            </Badge>
          </div>
          {data.alternatives?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Alternativas</div>
              <ul className="space-y-1 text-xs">
                {data.alternatives.map((a) => (
                  <li key={a.name}>
                    <span className="font-medium">{a.name}</span>{" "}
                    <span className="text-muted-foreground">— {a.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.warnings?.length > 0 && (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{data.warnings.join(" · ")}</span>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={generate} disabled={loading}>
            Regenerar
          </Button>
        </div>
      )}
    </div>
  );
}
