import { Star } from "lucide-react";
import { cn } from "@navaxa/ui";

const INDEXES = [0, 1, 2, 3, 4];

/**
 * Estrellas de solo lectura con relleno fraccionario (sirve para promedios, ej. 4.3).
 */
export function Stars({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;
  const dim = { width: size, height: size };
  return (
    <span
      className={cn("relative inline-flex", className)}
      role="img"
      aria-label={`${value.toFixed(1)} de 5`}
    >
      <span className="flex text-muted-foreground/30">
        {INDEXES.map((i) => (
          <Star key={i} style={dim} className="shrink-0" />
        ))}
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden text-accent"
        style={{ width: `${pct}%` }}
      >
        {INDEXES.map((i) => (
          <Star key={i} style={dim} className="shrink-0 fill-current" />
        ))}
      </span>
    </span>
  );
}
