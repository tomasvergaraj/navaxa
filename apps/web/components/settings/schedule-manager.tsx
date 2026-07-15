"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button, cn } from "@navaxa/ui";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface Window {
  weekday: number;
  startMin: number;
  endMin: number;
}
interface Barber {
  id: string;
  name: string;
  schedule: Window[];
}

const DAYS: { wd: number; label: string }[] = [
  { wd: 1, label: "Lunes" },
  { wd: 2, label: "Martes" },
  { wd: 3, label: "Miércoles" },
  { wd: 4, label: "Jueves" },
  { wd: 5, label: "Viernes" },
  { wd: 6, label: "Sábado" },
  { wd: 0, label: "Domingo" },
];

type DayState = Record<number, { open: boolean; from: string; to: string }>;

const minToTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function initFrom(barber: Barber | undefined): DayState {
  const state: DayState = {};
  for (const { wd } of DAYS) {
    const win = barber?.schedule.find((w) => w.weekday === wd);
    state[wd] = win
      ? { open: true, from: minToTime(win.startMin), to: minToTime(win.endMin) }
      : { open: false, from: "10:00", to: "20:00" };
  }
  return state;
}

export function ScheduleManager({ barbers }: { barbers: Barber[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(barbers[0]?.id ?? "");
  const selected = useMemo(() => barbers.find((b) => b.id === selectedId), [barbers, selectedId]);
  const [days, setDays] = useState<DayState>(() => initFrom(barbers[0]));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDays(initFrom(barbers.find((b) => b.id === selectedId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, barbers]);

  function setDay(wd: number, patch: Partial<DayState[number]>) {
    setDays((d) => ({ ...d, [wd]: { ...d[wd], ...patch } }));
  }

  async function save() {
    // Validación: en días abiertos, inicio < término.
    const windows: Window[] = [];
    for (const { wd, label } of DAYS) {
      const d = days[wd];
      if (!d.open) continue;
      const startMin = timeToMin(d.from);
      const endMin = timeToMin(d.to);
      if (startMin >= endMin) {
        toast.error(`${label}: la hora de término debe ser mayor a la de inicio`);
        return;
      }
      windows.push({ weekday: wd, startMin, endMin });
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/barbers/${selectedId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success("Horario guardado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (barbers.length === 0) {
    return <p className="p-5 text-sm text-muted-foreground">Agrega barberos para configurar sus horarios.</p>;
  }

  return (
    <div className="p-5">
      {barbers.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              aria-pressed={b.id === selectedId}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                b.id === selectedId ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <p className="mb-4 text-xs text-muted-foreground">
        Define los días y horas en que {selected?.name ?? "el barbero"} atiende. Esto determina las horas
        disponibles para reservar.
      </p>

      <div className="space-y-2">
        {DAYS.map(({ wd, label }) => {
          const d = days[wd];
          return (
            <div key={wd} className="flex items-center gap-3 rounded-md border border-border p-3">
              <Switch checked={d.open} onChange={(v) => setDay(wd, { open: v })} aria-label={label} />
              <span className="w-24 text-sm font-medium">{label}</span>
              {d.open ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={d.from}
                    aria-label={`${label} desde`}
                    onChange={(e) => setDay(wd, { from: e.target.value })}
                    className="h-9 rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="text-muted-foreground">a</span>
                  <input
                    type="time"
                    value={d.to}
                    aria-label={`${label} hasta`}
                    onChange={(e) => setDay(wd, { to: e.target.value })}
                    className="h-9 rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar horario
        </Button>
      </div>
    </div>
  );
}
