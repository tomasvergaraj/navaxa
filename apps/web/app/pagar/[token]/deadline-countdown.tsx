"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Cuenta regresiva del deadline de pago. La hora absoluta la formatea el
 * servidor (en la timezone del tenant); acá solo se agrega el "quedan mm:ss",
 * que arranca después del mount para no romper la hidratación.
 *
 * Al llegar a cero refresca: el server component ya renderiza la rama de
 * "expirado" y la hora se liberó igual del lado del backend.
 */
export function DeadlineCountdown({
  expiresAt,
  timeLabel,
}: {
  expiresAt: string;
  timeLabel: string;
}) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Un solo refresh al agotarse, no uno por tick.
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);

  const urgent = left !== null && left <= 5 * 60_000;

  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Tienes hasta las <strong className="text-foreground">{timeLabel}</strong> para pagar; si no,
      la hora se libera automáticamente.
      {left !== null && (
        <>
          {" "}
          <span
            role="timer"
            aria-live="off"
            className={`font-medium tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}
          >
            {left === 0 ? "Tiempo agotado." : `Quedan ${formatLeft(left)}.`}
          </span>
        </>
      )}
    </p>
  );
}

function formatLeft(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
