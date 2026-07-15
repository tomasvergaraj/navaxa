import { formatCLP } from "@/lib/format";
import type { ChartPoint } from "@/lib/reports";

/** Gráfico de barras simple (sin dependencias). Tooltip nativo en hover. */
export function BarChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  const total = points.reduce((s, p) => s + p.value, 0);

  return (
    <div
      role="img"
      aria-label={`Gráfico de barras: ${points.length} períodos, total ${formatCLP(total)}, máximo ${formatCLP(max)}`}
    >
      <div className="flex h-48 items-end gap-1">
        {points.map((p, i) => (
          <div
            key={i}
            className="group flex h-full flex-1 flex-col justify-end"
            title={`${p.label}: ${formatCLP(p.value)}`}
          >
            <div
              className="w-full rounded-t bg-accent-ink/80 transition-colors group-hover:bg-accent-ink"
              style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        {points.map((p, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 whitespace-nowrap text-center text-[10px] text-muted-foreground"
          >
            {i % labelEvery === 0 ? p.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
