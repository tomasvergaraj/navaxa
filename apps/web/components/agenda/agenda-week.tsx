import Link from "next/link";
import { cn } from "@navaxa/ui";
import type { WeekCapacity } from "@/lib/agenda";
import { formatDuration } from "@/lib/format";

const COLS = "140px repeat(7, minmax(0, 1fr))";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AgendaWeek({ capacity }: { capacity: WeekCapacity }) {
  const today = todayStr();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="min-w-[680px]">
        {/* Cabecera de días */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: COLS }}>
          <div className="border-r border-border p-2 text-xs font-medium text-muted-foreground">
            Barbero
          </div>
          {capacity.days.map((d) => {
            const dayNum = Number(d.date.slice(8, 10));
            const isToday = d.date === today;
            return (
              <div
                key={d.date}
                className={cn("p-2 text-center text-xs", isToday && "bg-accent/10")}
              >
                <div className="font-medium">{d.label}</div>
                <div className="text-muted-foreground">{dayNum}</div>
              </div>
            );
          })}
        </div>

        {/* Filas por barbero */}
        {capacity.rows.map((row) => {
          const occ =
            row.totalAvailableMin > 0
              ? Math.round((row.totalBookedMin / row.totalAvailableMin) * 100)
              : 0;
          return (
            <div
              key={row.barberId}
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: COLS }}
            >
              <div className="flex flex-col justify-center border-r border-border p-2">
                <span className="truncate text-sm font-medium">{row.barberName}</span>
                <span className="text-xs text-muted-foreground">{occ}% semana</span>
              </div>
              {row.cells.map((cell) => {
                const closed = cell.availableMin === 0;
                const pct = Math.round(cell.pct * 100);
                const isToday = cell.date === today;
                return (
                  <Link
                    key={cell.date}
                    href={`/agenda?date=${cell.date}`}
                    title={
                      closed
                        ? "Sin horario ese día"
                        : `${formatDuration(cell.bookedMin)} de ${formatDuration(cell.availableMin)} · ${cell.count} cita${cell.count === 1 ? "" : "s"}`
                    }
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center gap-0.5 border-l border-border text-xs transition-colors hover:ring-2 hover:ring-inset hover:ring-foreground/30",
                      isToday && "ring-1 ring-inset ring-accent/40",
                    )}
                    style={
                      closed
                        ? undefined
                        : { backgroundColor: `rgba(16, 185, 129, ${0.1 + cell.pct * 0.55})` }
                    }
                  >
                    {closed ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className="font-medium tabular-nums">{pct}%</span>
                        <span className="text-[10px] text-muted-foreground">
                          {cell.count} cita{cell.count === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
