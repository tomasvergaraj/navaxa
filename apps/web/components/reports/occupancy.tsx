import { Fragment } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { formatMinutes, type BarberOccupancy, type OccupancyResult } from "@/lib/occupancy";

const pctLabel = (pct: number) => `${Math.round(pct * 100)}%`;

/** Barra horizontal de ocupación, escala fija 0–100%. */
export function OccupancyBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-muted ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent-ink/80"
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  );
}

/** Lista de barberos con su % de ocupación en el período. */
export function OccupancyBarList({ rows }: { rows: BarberOccupancy[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((b) => (
        <li key={b.id} title={`${b.name}: ${formatMinutes(b.bookedMin)} de ${formatMinutes(b.capacityMin)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{b.name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {b.capacityMin > 0 ? pctLabel(b.pct) : "Sin horario"}
            </span>
          </div>
          <OccupancyBar pct={b.capacityMin > 0 ? b.pct : 0} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Perfil día × hora del período: dónde se llena y dónde quedan horas muertas.
 * Celdas sin capacidad (local cerrado) van casi invisibles; la intensidad del
 * dorado crece con la ocupación.
 */
export function OccupancyHeatmap({ heatmap }: { heatmap: NonNullable<OccupancyResult["heatmap"]> }) {
  const { hours, days } = heatmap;
  const openDays = days.filter((d) => d.cells.some((c) => c.pct !== null));

  return (
    <div className="overflow-x-auto">
      <div
        role="img"
        aria-label={`Ocupación por día y hora: ${openDays
          .map((d) => {
            const open = d.cells.filter((c) => c.pct !== null);
            const avg = open.length ? open.reduce((s, c) => s + (c.pct ?? 0), 0) / open.length : 0;
            return `${d.label} ${pctLabel(avg)}`;
          })
          .join(", ")}`}
        className="min-w-[28rem]"
      >
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: `2.5rem repeat(${hours.length}, minmax(1.25rem, 1fr))` }}
        >
          <div />
          {hours.map((h, i) => (
            <div key={h} className="pb-1 text-center text-[10px] tabular-nums text-muted-foreground">
              {i % 2 === 0 ? `${h}` : ""}
            </div>
          ))}
          {openDays.map((d) => (
            <Fragment key={d.weekday}>
              <div className="flex items-center pr-2 text-xs text-muted-foreground">{d.label}</div>
              {d.cells.map((c) => (
                <div
                  key={`${d.weekday}-${c.hour}`}
                  className="aspect-square min-h-5 rounded-[3px]"
                  style={
                    c.pct === null
                      ? { backgroundColor: "hsl(var(--muted) / 0.4)" }
                      : { backgroundColor: `hsl(var(--accent-ink) / ${0.12 + c.pct * 0.88})` }
                  }
                  title={
                    c.pct === null
                      ? `${d.label} ${c.hour}:00 — cerrado`
                      : `${d.label} ${c.hour}:00 — ${pctLabel(c.pct)} (${formatMinutes(c.bookedMin)} de ${formatMinutes(c.capacityMin)})`
                  }
                />
              ))}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          Libre
          {[0.12, 0.34, 0.56, 0.78, 1].map((a) => (
            <span
              key={a}
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: `hsl(var(--accent-ink) / ${a})` }}
            />
          ))}
          Lleno
        </div>
      </div>
    </div>
  );
}

/** Aviso de que el desglose de ocupación es de plan Pro. */
export function OccupancyUpsell() {
  return (
    <p className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        El desglose por barbero y el mapa de horas están en el plan Pro.{" "}
        <Link href="/configuracion?tab=plan" className="font-medium underline hover:text-foreground">
          Ver planes
        </Link>
      </span>
    </p>
  );
}
