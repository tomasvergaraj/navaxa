"use client";

import { useEffect, useRef } from "react";

/**
 * Widget de Cloudflare Turnstile (render explícito).
 *
 * Emite el token por `onToken` y `null` cuando expira o falla, para que el
 * formulario sepa que ya no tiene un token válido. El script se carga una sola
 * vez por página aunque haya varias instancias.
 */

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        // Permite reintentar en un remount si la primera carga falló (red caída).
        scriptPromise = null;
        reject(new Error("No se pudo cargar Turnstile"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/** El script resuelve su onload un tick antes de exponer window.turnstile. */
async function waitForApi(timeoutMs = 8000): Promise<TurnstileApi> {
  const deadline = Date.now() + timeoutMs;
  while (!window.turnstile) {
    if (Date.now() > deadline) throw new Error("Turnstile no inicializó");
    await new Promise((r) => setTimeout(r, 50));
  }
  return window.turnstile;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  action,
  className,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  action?: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // El callback cambia en cada render del padre; via ref evitamos re-montar el
  // widget (cada remount pide un challenge nuevo).
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;

    void loadScript()
      .then(() => waitForApi())
      .then((api) => {
        if (cancelled || !boxRef.current) return;
        widgetId = api.render(boxRef.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action]);

  return <div ref={boxRef} className={className} />;
}
