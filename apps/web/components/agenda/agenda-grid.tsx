"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@navaxa/ui";
import type { AppointmentStatus } from "@navaxa/db";
import { APPOINTMENT_STATUS_LABELS } from "@navaxa/config";
import type { GridBlock, GridColumn } from "@/lib/agenda";
import { formatCLP } from "@/lib/format";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { AppointmentDetailDialog } from "@/components/agenda/appointment-detail-dialog";

// Escala y layout (rendering, lado cliente). PX_PER_MIN coincide con lib/agenda.
const PX_PER_MIN = 2;
const SNAP_MIN = 10;
const COL_W = 156;
const GUTTER_W = 56;
const MIN_BLOCK_PX = 22;
// Táctil: mantener presionado este tiempo para "tomar" la cita (evita conflicto con scroll).
const LONG_PRESS_MS = 420;
// Si el dedo se mueve más que esto antes de que dispare el long-press, se interpreta como scroll.
const MOVE_TOLERANCE = 10;
// Auto-scroll al acercar el arrastre a los bordes del contenedor.
const EDGE = 44;
const MAX_SPEED = 16;
// Aire entre el header pegajoso (sticky) y la primera hora, para que no la tape.
const TOP_PAD = 12;

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  SCHEDULED: "border-l-sky-500 bg-sky-500/10",
  CONFIRMED: "border-l-emerald-500 bg-emerald-500/10",
  IN_PROGRESS: "border-l-violet-500 bg-violet-500/10",
  PENDING_PAYMENT: "border-l-amber-500 bg-amber-500/15",
  COMPLETED: "border-l-zinc-400 bg-zinc-500/10",
  NO_SHOW: "border-l-rose-500 bg-rose-500/10",
  CANCELLED: "border-l-zinc-300 bg-zinc-500/5",
};

const LEGEND: { status: AppointmentStatus; dot: string }[] = [
  { status: "SCHEDULED", dot: "bg-sky-500" },
  { status: "CONFIRMED", dot: "bg-emerald-500" },
  { status: "IN_PROGRESS", dot: "bg-violet-500" },
  { status: "PENDING_PAYMENT", dot: "bg-amber-500" },
  { status: "COMPLETED", dot: "bg-zinc-400" },
  { status: "NO_SHOW", dot: "bg-rose-500" },
];

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface DragState {
  id: string;
  durationMin: number;
  offsetMin: number; // minutos entre el tope del bloque y el punto de agarre (vertical)
  grabOffsetX: number; // px entre el borde izq. del bloque y el punto de agarre (horizontal)
  originStartMin: number;
  originBarberId: string;
  pointerX: number; // posición viewport del puntero (para el bloque flotante libre)
  pointerY: number;
  ghostStartMin: number; // destino "encajado" (para la vista previa)
  ghostBarberId: string;
}

interface AgendaGridProps {
  dateStr: string;
  dayStartMs: number;
  isToday: boolean;
  startMin: number;
  endMin: number;
  columns: GridColumn[];
}

export function AgendaGrid({ dateStr, dayStartMs, isToday, startMin, endMin, columns }: AgendaGridProps) {
  const router = useRouter();
  const totalHeight = (endMin - startMin) * PX_PER_MIN;

  // Overrides optimistas: id -> nueva posición (hasta que el refresh traiga la verdad).
  const [overrides, setOverrides] = useState<Record<string, { startMin: number; endMin: number; barberId: string }>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [nowMin, setNowMin] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const scrollVelRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  // Suprime el "click" que el navegador dispara tras soltar un arrastre (mouse).
  const suppressClickRef = useRef(false);

  // Quick-create
  const [createOpen, setCreateOpen] = useState(false);
  const [preset, setPreset] = useState<{ barberId: string; startIso: string } | null>(null);

  // Detalle/edición de una cita: click (o tap) sobre un bloque.
  const [detailBlock, setDetailBlock] = useState<GridBlock | null>(null);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let m = startMin; m <= endMin; m += 60) out.push(m);
    return out;
  }, [startMin, endMin]);

  const allBlocks = useMemo(() => columns.flatMap((c) => c.blocks), [columns]);
  const blockById = useMemo(() => {
    const m = new Map<string, GridBlock>();
    for (const b of allBlocks) m.set(b.id, b);
    return m;
  }, [allBlocks]);

  // Línea de "ahora": timer en cliente (mueve una línea CSS, sin red).
  useEffect(() => {
    if (!isToday) {
      setNowMin(null);
      return;
    }
    const tick = () => setNowMin((Date.now() - dayStartMs) / 60000);
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [isToday, dayStartMs]);

  // Al montar: hacer scroll a "ahora" (o al inicio de la grilla). Calcula "ahora"
  // en vivo: el estado nowMin aún es null en el primer render (lo setea otro efecto).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const liveNow = (Date.now() - dayStartMs) / 60000;
    const target = isToday && liveNow > startMin && liveNow < endMin ? liveNow : startMin;
    el.scrollTop = Math.max(0, (target - startMin) * PX_PER_MIN + TOP_PAD - 80);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isoFromMin = useCallback(
    (min: number) => new Date(dayStartMs + min * 60_000).toISOString(),
    [dayStartMs],
  );

  const reschedule = useCallback(
    async (id: string, newStartMin: number, durationMin: number, barberId: string) => {
      setOverrides((o) => ({ ...o, [id]: { startMin: newStartMin, endMin: newStartMin + durationMin, barberId } }));
      try {
        const res = await fetch(`/api/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startsAt: isoFromMin(newStartMin), barberId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo reagendar");
        toast.success("Cita reagendada");
        router.refresh();
      } catch (e) {
        setOverrides((o) => {
          const next = { ...o };
          delete next[id];
          return next;
        });
        toast.error((e as Error).message);
      }
    },
    [isoFromMin, router],
  );

  // Recalcula el destino "encajado" (preview) y la posición libre del puntero.
  const updateGhost = useCallback(
    (clientX: number, clientY: number) => {
      const d = dragRef.current;
      const wrap = columnsRef.current;
      if (!d || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      let newStart = startMin + (clientY - rect.top) / PX_PER_MIN - d.offsetMin;
      newStart = clamp(Math.round(newStart / SNAP_MIN) * SNAP_MIN, startMin, endMin - d.durationMin);
      const idx = clamp(Math.floor((clientX - rect.left) / COL_W), 0, columns.length - 1);
      const ghostBarberId = columns[idx]?.barberId ?? d.ghostBarberId;
      const next: DragState = { ...d, pointerX: clientX, pointerY: clientY, ghostStartMin: newStart, ghostBarberId };
      dragRef.current = next;
      setDrag(next);
    },
    [startMin, endMin, columns],
  );

  // Define la velocidad de auto-scroll según la cercanía del puntero a cada borde.
  const updateAutoScroll = useCallback((clientX: number, clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ramp = (dist: number) => clamp(1 - dist / EDGE, 0, 1) * MAX_SPEED;
    let vx = 0;
    let vy = 0;
    if (clientX < r.left + EDGE) vx = -ramp(clientX - r.left);
    else if (clientX > r.right - EDGE) vx = ramp(r.right - clientX);
    if (clientY < r.top + EDGE) vy = -ramp(clientY - r.top);
    else if (clientY > r.bottom - EDGE) vy = ramp(r.bottom - clientY);
    scrollVelRef.current = { x: vx, y: vy };
  }, []);

  // Loop de auto-scroll: desplaza el contenedor y reubica el destino bajo el puntero.
  const autoScrollTick = useCallback(() => {
    const el = scrollRef.current;
    const v = scrollVelRef.current;
    if (el && (v.x !== 0 || v.y !== 0)) {
      const beforeL = el.scrollLeft;
      const beforeT = el.scrollTop;
      el.scrollLeft += v.x;
      el.scrollTop += v.y;
      if (el.scrollLeft !== beforeL || el.scrollTop !== beforeT) {
        const p = lastPointerRef.current;
        updateGhost(p.x, p.y);
      }
    }
    rafRef.current = requestAnimationFrame(autoScrollTick);
  }, [updateGhost]);

  const preventTouchScroll = useCallback((e: TouchEvent) => {
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      updateGhost(e.clientX, e.clientY);
      updateAutoScroll(e.clientX, e.clientY);
    },
    [updateGhost, updateAutoScroll],
  );

  const endDrag = useCallback(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("touchmove", preventTouchScroll);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    scrollVelRef.current = { x: 0, y: 0 };
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    // Tras soltar, el navegador dispara un click; si terminó sobre el fondo de la
    // columna abriría el agendamiento. Lo ignoramos por un tick.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    if (d.ghostStartMin === d.originStartMin && d.ghostBarberId === d.originBarberId) {
      // No hubo movimiento real: tratamos el gesto como un "click" sobre el bloque
      // y abrimos el detalle. (Mouse: preventDefault en pointerdown ya impide el
      // click nativo, así que esta es la única ruta. Touch sin long-press no llega
      // a activateDrag y abre detalle vía onClick del bloque.)
      const b = blockById.get(d.id);
      if (b) setDetailBlock(b);
      return;
    }
    void reschedule(d.id, d.ghostStartMin, d.durationMin, d.ghostBarberId);
  }, [onPointerMove, preventTouchScroll, reschedule, blockById]);

  const activateDrag = useCallback(
    (block: GridBlock, clientX: number, clientY: number, isTouch: boolean) => {
      const wrap = columnsRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const pointerMin = startMin + (clientY - rect.top) / PX_PER_MIN;
      const colIndex = Math.max(0, columns.findIndex((c) => c.barberId === block.barberId));
      const blockLeftX = rect.left + colIndex * COL_W + 2;
      const state: DragState = {
        id: block.id,
        durationMin: block.endMin - block.startMin,
        offsetMin: pointerMin - block.startMin,
        grabOffsetX: clientX - blockLeftX,
        originStartMin: block.startMin,
        originBarberId: block.barberId,
        pointerX: clientX,
        pointerY: clientY,
        ghostStartMin: block.startMin,
        ghostBarberId: block.barberId,
      };
      dragRef.current = state;
      lastPointerRef.current = { x: clientX, y: clientY };
      setDrag(state);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      window.addEventListener("touchmove", preventTouchScroll, { passive: false });
      if (isTouch) navigator.vibrate?.(20);
      rafRef.current = requestAnimationFrame(autoScrollTick);
    },
    [startMin, columns, onPointerMove, endDrag, preventTouchScroll, autoScrollTick],
  );

  const beginDrag = useCallback(
    (block: GridBlock, e: ReactPointerEvent) => {
      if (!block.draggable) return;
      e.stopPropagation();

      // Mouse: arrastre inmediato (el escritorio espera click-drag).
      if (e.pointerType === "mouse") {
        e.preventDefault();
        activateDrag(block, e.clientX, e.clientY, false);
        return;
      }

      // Táctil/lápiz: requiere mantener presionado. No prevenimos el default
      // para que, si el usuario quiere desplazarse, el scroll funcione normal.
      const startX = e.clientX;
      const startY = e.clientY;
      let timer = 0;
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("pointermove", probeMove);
        window.removeEventListener("pointerup", probeEnd);
        window.removeEventListener("pointercancel", probeEnd);
      };
      const probeMove = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_TOLERANCE) cleanup();
      };
      const probeEnd = () => cleanup();
      timer = window.setTimeout(() => {
        cleanup();
        activateDrag(block, startX, startY, true);
      }, LONG_PRESS_MS);
      window.addEventListener("pointermove", probeMove);
      window.addEventListener("pointerup", probeEnd);
      window.addEventListener("pointercancel", probeEnd);
    },
    [activateDrag],
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("touchmove", preventTouchScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [onPointerMove, endDrag, preventTouchScroll],
  );

  function openCreateAt(barberId: string, clientY: number) {
    const wrap = columnsRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    let min = startMin + (clientY - rect.top) / PX_PER_MIN;
    min = clamp(Math.round(min / SNAP_MIN) * SNAP_MIN, startMin, endMin - SNAP_MIN);
    setPreset({ barberId, startIso: isoFromMin(min) });
    setCreateOpen(true);
  }

  // Posición efectiva del bloque (override optimista o la del servidor).
  function placed(block: GridBlock): { startMin: number; endMin: number; barberId: string } {
    return overrides[block.id] ?? { startMin: block.startMin, endMin: block.endMin, barberId: block.barberId };
  }

  const draggedBlock = drag ? blockById.get(drag.id) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Tip de arrastre (arriba) */}
      <div className="mb-2 shrink-0 text-xs text-muted-foreground">
        <span className="hidden sm:inline">Arrastra una cita para reagendar · click en un hueco para agendar</span>
        <span className="sm:hidden">Mantén presionada una cita para moverla · toca un hueco para agendar</span>
      </div>
      <div
        ref={scrollRef}
        className={cn("relative min-h-0 flex-1 overflow-auto rounded-lg border border-border", drag && "select-none")}
        style={{ touchAction: drag ? "none" : undefined }}
      >
        <div className="relative" style={{ width: GUTTER_W + columns.length * COL_W, minWidth: "100%" }}>
          {/* Header: barberos (sticky arriba) */}
          <div className="sticky top-0 z-30 flex border-b border-border bg-background">
            <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-background" style={{ width: GUTTER_W }} />
            {columns.map((c) => (
              <div
                key={c.barberId}
                className="shrink-0 truncate border-r border-border px-2 py-2 text-center text-sm font-medium"
                style={{ width: COL_W }}
              >
                {c.barberName}
                <span className="ml-1 text-xs text-muted-foreground">({c.blocks.length})</span>
              </div>
            ))}
          </div>

          {/* Cuerpo (con aire arriba para que el header no tape la primera hora) */}
          <div className="flex" style={{ height: totalHeight + TOP_PAD, paddingTop: TOP_PAD }}>
            {/* Canaleta de horas (sticky izquierda) */}
            <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-background" style={{ width: GUTTER_W }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                  style={{ top: (h - startMin) * PX_PER_MIN }}
                >
                  {fmtMin(h)}
                </div>
              ))}
            </div>

            {/* Columnas de barberos */}
            <div ref={columnsRef} className="relative flex">
              {columns.map((c) => (
                <div
                  key={c.barberId}
                  className="relative shrink-0 border-r border-border"
                  style={{ width: COL_W }}
                  onClick={(e) => {
                    if (suppressClickRef.current) return;
                    openCreateAt(c.barberId, e.clientY);
                  }}
                  title="Click para agendar aquí"
                >
                  {/* Sombrear fuera del horario de trabajo */}
                  <ClosedShade startMin={startMin} endMin={endMin} windows={c.windows} />
                  {/* Líneas de hora y media hora */}
                  {hours.map((h) => (
                    <div key={h}>
                      <div className="absolute inset-x-0 border-t border-border/70" style={{ top: (h - startMin) * PX_PER_MIN }} />
                      {h + 30 <= endMin && (
                        <div className="absolute inset-x-0 border-t border-border/30" style={{ top: (h + 30 - startMin) * PX_PER_MIN }} />
                      )}
                    </div>
                  ))}

                  {/* Vista previa del destino (slot encajado, transparente, detrás del flotante) */}
                  {drag && drag.ghostBarberId === c.barberId && (
                    <div
                      className="pointer-events-none absolute left-0.5 right-0.5 z-20 rounded-md border-2 border-dashed border-foreground/50 bg-foreground/5"
                      style={{
                        top: (drag.ghostStartMin - startMin) * PX_PER_MIN,
                        height: Math.max(MIN_BLOCK_PX, drag.durationMin * PX_PER_MIN - 2),
                      }}
                    >
                      <div className="px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground/70">
                        {fmtMin(drag.ghostStartMin)}
                      </div>
                    </div>
                  )}

                  {/* Bloques de esta columna */}
                  {allBlocks
                    .filter((b) => placed(b).barberId === c.barberId)
                    .map((b) => {
                      const p = placed(b);
                      const dragging = drag?.id === b.id;
                      const height = Math.max(MIN_BLOCK_PX, (p.endMin - p.startMin) * PX_PER_MIN - 2);
                      const tooltip = `${fmtMin(p.startMin)}–${fmtMin(p.endMin)} · ${b.clientName}\n${b.serviceNames.join(", ")}${b.notes ? `\n${b.notes}` : ""}\n${APPOINTMENT_STATUS_LABELS[b.status]} · ${formatCLP(b.totalPrice)}`;
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          title={tooltip}
                          onClick={(e) => {
                            // Bloquea el click-en-hueco del padre y, si no veníamos de un
                            // drag (suppressClickRef se setea al soltar), abre el detalle.
                            e.stopPropagation();
                            if (suppressClickRef.current) return;
                            setDetailBlock(b);
                          }}
                          onPointerDown={(e) => beginDrag(b, e)}
                          className={cn(
                            "absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-l-4 border-border px-1.5 py-1 text-xs select-none",
                            STATUS_STYLE[b.status],
                            b.draggable ? "cursor-grab" : "cursor-default",
                            dragging && "opacity-40",
                          )}
                          style={{ top: (p.startMin - startMin) * PX_PER_MIN, height, WebkitTouchCallout: "none" }}
                        >
                          <div className="font-medium tabular-nums leading-tight">{fmtMin(p.startMin)}</div>
                          <div className="truncate leading-tight">{b.clientName}</div>
                          {height > 40 && (
                            <div className="truncate text-[10px] leading-tight text-muted-foreground">
                              {b.serviceNames.join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}

              {/* Línea de "ahora" (sobre las columnas) */}
              {nowMin != null && nowMin >= startMin && nowMin <= endMin && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-rose-500"
                  style={{ top: (nowMin - startMin) * PX_PER_MIN }}
                >
                  <span className="absolute -top-2 left-0 rounded-r bg-rose-500 px-1 text-[10px] font-medium text-white">
                    {fmtMin(Math.round(nowMin))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", l.dot)} />
            {APPOINTMENT_STATUS_LABELS[l.status]}
          </span>
        ))}
      </div>

      {/* Bloque flotante libre (sigue el cursor/dedo), por encima de todo */}
      {drag && draggedBlock && typeof document !== "undefined" &&
        createPortal(
          <div
            className={cn(
              "pointer-events-none fixed z-[60] overflow-hidden rounded-md border border-l-4 border-border px-1.5 py-1 text-xs opacity-90 shadow-2xl ring-2 ring-foreground/30",
              STATUS_STYLE[draggedBlock.status],
            )}
            style={{
              left: drag.pointerX - drag.grabOffsetX,
              top: drag.pointerY - drag.offsetMin * PX_PER_MIN,
              width: COL_W - 4,
              height: Math.max(MIN_BLOCK_PX, drag.durationMin * PX_PER_MIN - 2),
            }}
          >
            <div className="font-medium tabular-nums leading-tight">{fmtMin(drag.ghostStartMin)}</div>
            <div className="truncate leading-tight">{draggedBlock.clientName}</div>
          </div>,
          document.body,
        )}

      {/* Quick-create controlado */}
      <NewAppointmentDialog
        hideTrigger
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setPreset(null);
        }}
        presetBarberId={preset?.barberId}
        presetDate={dateStr}
        presetStartIso={preset?.startIso}
      />

      {/* Detalle de cita (click sobre un bloque). */}
      <AppointmentDetailDialog block={detailBlock} onClose={() => setDetailBlock(null)} />
    </div>
  );
}

/** Sombras grises para las franjas fuera del horario de trabajo del barbero. */
function ClosedShade({ startMin, endMin, windows }: { startMin: number; endMin: number; windows: { startMin: number; endMin: number }[] }) {
  if (windows.length === 0) {
    return <div className="absolute inset-0 bg-muted/40" />;
  }
  const closed: { from: number; to: number }[] = [];
  let cursor = startMin;
  for (const w of windows) {
    if (w.startMin > cursor) closed.push({ from: cursor, to: w.startMin });
    cursor = Math.max(cursor, w.endMin);
  }
  if (cursor < endMin) closed.push({ from: cursor, to: endMin });
  return (
    <>
      {closed.map((c, i) => (
        <div
          key={i}
          className="absolute inset-x-0 bg-muted/40"
          style={{ top: (c.from - startMin) * PX_PER_MIN, height: (c.to - c.from) * PX_PER_MIN }}
        />
      ))}
    </>
  );
}
