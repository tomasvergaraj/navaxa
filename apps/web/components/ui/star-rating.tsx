"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@navaxa/ui";

/** Selector interactivo de 1 a 5 estrellas. */
export function StarRating({
  value,
  onChange,
  size = 36,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          aria-label={`${i} estrella${i > 1 ? "s" : ""}`}
          className="transition-transform hover:scale-110"
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              "transition-colors",
              i <= active ? "fill-accent text-accent" : "fill-transparent text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
