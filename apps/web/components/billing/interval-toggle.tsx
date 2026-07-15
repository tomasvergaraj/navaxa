"use client";

import { cn } from "@navaxa/ui";

export type Interval = "MONTHLY" | "ANNUAL";

/**
 * Selector mensual/anual con pastilla deslizante. La pastilla blanca se mueve
 * con transición (translate) al cambiar de opción y marca claramente la activa.
 * Los dos botones son `flex-1` (mismo ancho) y la pastilla mide exactamente la
 * mitad útil, así translate-x-full la alinea justo con el segmento derecho.
 */
export function IntervalToggle({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (i: Interval) => void;
}) {
  const annual = value === "ANNUAL";
  return (
    <div className="relative flex w-full max-w-xs rounded-full border border-border bg-muted/50 p-1 text-sm">
      {/* Pastilla deslizante (color foreground → fuerte contraste y se adapta al tema) */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-foreground shadow-md transition-transform duration-300 ease-out motion-reduce:transition-none",
          annual && "translate-x-full",
        )}
      />
      <button
        type="button"
        onClick={() => onChange("MONTHLY")}
        aria-pressed={!annual}
        className={cn(
          "relative z-10 flex-1 rounded-full px-4 py-1.5 transition-colors duration-200",
          !annual ? "font-semibold text-background" : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        Mensual
      </button>
      <button
        type="button"
        onClick={() => onChange("ANNUAL")}
        aria-pressed={annual}
        className={cn(
          "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 transition-colors duration-200",
          annual ? "font-semibold text-background" : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        Anual
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-medium transition-colors duration-200",
            annual ? "bg-brand-brass text-brand-graphite" : "bg-brand-brass/15 text-accent-ink",
          )}
        >
          −17%
        </span>
      </button>
    </div>
  );
}
