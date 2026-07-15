"use client";

import { useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { cn } from "@navaxa/ui";

interface DayHours {
  weekday: number;
  startMin: number;
  endMin: number;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function todayWeekday(timezone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export function HoursToggle({ hours, timezone }: { hours: DayHours[]; timezone: string }) {
  const [open, setOpen] = useState(false);
  const map = new Map(hours.map((h) => [h.weekday, h]));
  const today = todayWeekday(timezone);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Clock className="h-4 w-4" />
        Ver horario
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {ORDER.map((wd) => {
            const h = map.get(wd);
            return (
              <li
                key={wd}
                className={cn(
                  "flex justify-between",
                  wd === today ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{DAY_NAMES[wd]}</span>
                <span>{h ? `${fmt(h.startMin)} – ${fmt(h.endMin)}` : "Cerrado"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
