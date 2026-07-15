"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, cn } from "@navaxa/ui";

const PRESETS = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "month", label: "Este mes" },
  { key: "prev_month", label: "Mes pasado" },
];

export function PeriodSelector({
  rangeKey,
  from,
  to,
}: {
  rangeKey: string;
  from: string; // YYYY-MM-DD
  to: string;
}) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const applyCustom = () => {
    if (customFrom && customTo) router.push(`/reportes?from=${customFrom}&to=${customTo}`);
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => router.push(`/reportes?range=${p.key}`)}
            aria-pressed={rangeKey === p.key}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              rangeKey === p.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="date"
          value={customFrom}
          max={customTo || undefined}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="h-9 w-[9.5rem] flex-1 sm:flex-none"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          value={customTo}
          min={customFrom || undefined}
          onChange={(e) => setCustomTo(e.target.value)}
          className="h-9 w-[9.5rem] flex-1 sm:flex-none"
        />
        <Button
          variant={rangeKey === "custom" ? "default" : "outline"}
          size="sm"
          onClick={applyCustom}
          disabled={!customFrom || !customTo}
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}
