"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, Plus, Search } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  cn,
  NativeSelect,
} from "@navaxa/ui";
import { toast } from "sonner";
import { formatCLP, formatDuration } from "@/lib/format";

interface Service { id: string; name: string; durationMin: number; price: number }
interface Barber { id: string; name: string }
interface Slot { startsAt: string; endsAt: string }
interface ClientLite { id: string; name: string }

async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Algo salió mal");
  return data;
}

export function NewAppointmentDialog({
  presetClient,
  label = "Nueva cita",
  open: controlledOpen,
  onOpenChange,
  presetBarberId,
  presetDate,
  presetStartIso,
  hideTrigger = false,
}: {
  presetClient?: ClientLite;
  label?: string;
  /** Modo controlado (p.ej. abierto desde la grilla de agenda). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Prefill al abrir: barbero, fecha (YYYY-MM-DD) y hora sugerida (ISO). */
  presetBarberId?: string;
  presetDate?: string;
  presetStartIso?: string;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (!isControlled) setInternalOpen(o);
  };

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  // Cliente
  const [client, setClient] = useState<ClientLite | null>(presetClient ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientLite[]>([]);
  // Opción resaltada del combobox (-1 = ninguna). El foco nunca sale del input:
  // la opción activa se anuncia por aria-activedescendant.
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    apiJson("/api/services").then((d) => setServices(d.services)).catch(() => {});
    apiJson("/api/barbers")
      .then((d) => setBarbers(d.barbers.map((b: { id: string; user: { name: string } }) => ({ id: b.id, name: b.user.name }))))
      .catch(() => {});
  }, [open]);

  // Prefill al abrir desde la grilla (click en un hueco): barbero + fecha.
  useEffect(() => {
    if (!open) return;
    if (presetBarberId) setBarberId(presetBarberId);
    if (presetDate) setDate(presetDate);
  }, [open, presetBarberId, presetDate]);

  const pickClient = (c: ClientLite) => {
    setClient(c);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
  };

  // Búsqueda de clientes (debounce simple)
  useEffect(() => {
    if (presetClient || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const d = await apiJson(`/api/clients?q=${encodeURIComponent(query.trim())}&take=6`);
        if (stale) return; // respuesta de una búsqueda anterior: descartar
        setActiveIndex(-1); // resultados nuevos ⇒ ninguna opción resaltada
        setResults(
          d.clients.map((c: { id: string; firstName: string; lastName: string | null }) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
          })),
        );
      } catch {
        if (!stale) setResults([]);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query, presetClient]);

  // Disponibilidad
  useEffect(() => {
    setSlot(null);
    if (!barberId || !date || selectedServices.length === 0) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    const ctrl = new AbortController();
    apiJson("/api/appointments/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberId, date: `${date}T12:00:00.000Z`, serviceIds: selectedServices }),
      signal: ctrl.signal,
    })
      .then((d) => {
        setSlots(d.slots);
        // Si vino una hora sugerida (click en la grilla), preselecciona el slot más cercano.
        if (presetStartIso && d.slots.length > 0) {
          const target = new Date(presetStartIso).getTime();
          const nearest = (d.slots as Slot[]).reduce((best, s) =>
            Math.abs(new Date(s.startsAt).getTime() - target) < Math.abs(new Date(best.startsAt).getTime() - target)
              ? s
              : best,
          );
          setSlot(nearest);
        }
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return; // reemplazada por una petición más nueva
        toast.error(e.message);
        setSlots([]);
      })
      .finally(() => setLoadingSlots(false));
    return () => ctrl.abort();
  }, [barberId, date, selectedServices, presetStartIso]);

  const totals = useMemo(() => {
    const chosen = services.filter((s) => selectedServices.includes(s.id));
    return {
      price: chosen.reduce((a, s) => a + s.price, 0),
      duration: chosen.reduce((a, s) => a + s.durationMin, 0),
    };
  }, [services, selectedServices]);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

  function toggleService(id: string) {
    setSelectedServices((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }


  // Alta rápida sin salir del flujo: antes "sin resultados" te expulsaba a la
  // sección Clientes a mitad del agendamiento.
  async function quickCreateClient() {
    const name = query.trim();
    if (!name || creatingClient) return;
    setCreatingClient(true);
    try {
      const parts = name.split(/\s+/);
      const d = await apiJson("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: parts[0], lastName: parts.slice(1).join(" ") }),
      });
      setClient({ id: d.client.id, name });
      setQuery("");
      setResults([]);
      toast.success("Cliente creado — recuerda completar su teléfono después");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreatingClient(false);
    }
  }

  async function submit() {
    if (!client || !slot) return;
    setSubmitting(true);
    try {
      await apiJson("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          barberId,
          startsAt: slot.startsAt,
          serviceIds: selectedServices,
          source: "walkin",
        }),
      });
      toast.success("Cita agendada");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSelectedServices([]);
    setBarberId("");
    setDate("");
    setSlots([]);
    setSlot(null);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    if (!presetClient) setClient(null);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {!hideTrigger && (
        <Button onClick={() => setOpen(true)}>
          <CalendarPlus className="h-4 w-4" />
          {label}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              {client ? (
                <div className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
                  <span className="font-medium">{client.name}</span>
                  {!presetClient && (
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setClient(null)}>
                      cambiar
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    type="search"
                    role="combobox"
                    aria-expanded={results.length > 0}
                    aria-controls="client-results"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeIndex >= 0 && results[activeIndex]
                        ? `client-opt-${results[activeIndex].id}`
                        : undefined
                    }
                    aria-label="Buscar cliente por nombre o teléfono"
                    placeholder="Buscar por nombre o teléfono…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      if (results.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((i) => (i + 1) % results.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        setActiveIndex(0);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        setActiveIndex(results.length - 1);
                      } else if (e.key === "Enter" && activeIndex >= 0) {
                        e.preventDefault();
                        pickClient(results[activeIndex]);
                      } else if (e.key === "Escape" && activeIndex >= 0) {
                        // Solo cierra la lista; el Escape del diálogo se maneja
                        // más arriba y no queremos cerrarlo entero por error.
                        e.preventDefault();
                        e.stopPropagation();
                        setResults([]);
                        setActiveIndex(-1);
                      }
                    }}
                  />
                  {query.trim().length >= 2 && results.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1.5 w-full"
                      loading={creatingClient}
                      onClick={() => void quickCreateClient()}
                    >
                      <Plus className="h-4 w-4" />
                      Crear cliente «{query.trim()}»
                    </Button>
                  )}
                  {results.length > 0 && (
                    <div
                      id="client-results"
                      role="listbox"
                      aria-label="Clientes encontrados"
                      className="mt-1 rounded-md border border-border"
                    >
                      {results.map((c, i) => (
                        <button
                          key={c.id}
                          id={`client-opt-${c.id}`}
                          role="option"
                          aria-selected={i === activeIndex}
                          tabIndex={-1}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => pickClient(c)}
                          className={cn(
                            "block w-full px-3 py-2 text-left text-sm",
                            i === activeIndex ? "bg-muted" : "hover:bg-muted",
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Servicios */}
            <div className="space-y-1.5">
              <Label>Servicios</Label>
              <div className="space-y-1.5">
                {services.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay servicios configurados. Créalos en Configuración → Servicios.
                  </p>
                )}
                {services.map((s) => {
                  const active = selectedServices.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border p-2.5 text-left text-sm transition-colors",
                        active ? "border-foreground bg-accent/10" : "border-border hover:bg-muted",
                      )}
                    >
                      <span>{s.name} · {formatDuration(s.durationMin)}</span>
                      <span className="flex items-center gap-2">
                        {formatCLP(s.price)}
                        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", active ? "border-foreground bg-foreground text-background" : "border-border")}>
                          {active && <Check className="h-3 w-3" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Barbero + fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="a-barber">Barbero</Label>
                <NativeSelect
                  id="a-barber"
                  value={barberId}
                  onChange={(e) => setBarberId(e.target.value)}
                >
                  <option value="">Elegir…</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-date">Fecha</Label>
                <Input id="a-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            {/* Horas */}
            {barberId && date && selectedServices.length > 0 && (
              <div className="space-y-1.5">
                <Label>Hora ({formatDuration(totals.duration)} · {formatCLP(totals.price)})</Label>
                {loadingSlots ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando horas…
                  </p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay horas disponibles ese día.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((sl) => (
                      <button
                        key={sl.startsAt}
                        onClick={() => setSlot(sl)}
                        aria-pressed={slot?.startsAt === sl.startsAt}
                        className={cn(
                          "min-h-[40px] rounded-md border py-1.5 text-sm transition-colors",
                          slot?.startsAt === sl.startsAt ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                        )}
                      >
                        {fmtTime(sl.startsAt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={submitting || !client || !slot}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
