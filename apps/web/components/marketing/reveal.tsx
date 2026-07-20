"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@navaxa/ui";

/**
 * Revela su contenido con un fade-up cuando entra al viewport (IntersectionObserver,
 * sin dependencias). Respeta prefers-reduced-motion. `delay` escalona elementos.
 */
const HIDDEN: Record<string, string> = {
  up: "translate-y-6 opacity-0",
  fade: "opacity-0",
  scale: "translate-y-4 scale-[0.98] opacity-0",
};

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Cómo entra: fade-up (default), solo fade, o fade+scale sutil para cards. */
  variant?: "up" | "fade" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Visible por defecto: el SSR/no-JS debe mostrar TODO el contenido (antes la
  // página nacía opacity-0 y sin hidratar los precios no se veían nunca).
  // Tras hidratar, solo lo que está bajo el viewport se oculta y se revela al
  // entrar — la animación pasa a ser mejora progresiva.
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // ya visible: no animar
    setShown(false);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out-quart motion-reduce:transition-none motion-reduce:transform-none",
        shown ? "translate-y-0 scale-100 opacity-100" : HIDDEN[variant],
        className,
      )}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
