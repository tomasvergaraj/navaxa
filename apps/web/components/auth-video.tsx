"use client";

import { useEffect, useRef } from "react";

/**
 * Video de ambiente del panel de auth. Respeta prefers-reduced-motion
 * (queda pausado en el poster) — un <video autoPlay> solo no lo hace.
 */
export function AuthVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      v.removeAttribute("autoplay");
    }
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      loop
      muted
      playsInline
      poster="/videos/barber-loop-poster.jpg"
    >
      <source src="/videos/barber-loop.mp4" type="video/mp4" />
    </video>
  );
}
