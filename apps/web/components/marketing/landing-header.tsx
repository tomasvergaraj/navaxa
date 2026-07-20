"use client";

import { useEffect, useState } from "react";
import { cn } from "@navaxa/ui";

/**
 * Barra superior del landing: transparente sobre el hero y con fondo + hairline
 * solo al scrollear (el hero respira sin línea de corte arriba).
 */
export function LandingHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-border/70 bg-background/85 backdrop-blur"
          : "border-transparent bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
