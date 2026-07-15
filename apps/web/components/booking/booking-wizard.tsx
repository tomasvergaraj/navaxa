"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  Clock,
  Loader2,
  Scissors,
  User,
  Users,
  CalendarCheck,
} from "lucide-react";
import { Button, Input, Label, cn } from "@navaxa/ui";
import { toast } from "sonner";
import { formatCLP, formatDuration } from "@/lib/format";
import { PhoneInput } from "@/components/ui/phone-input";

interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  price: number;
  category?: string | null;
}
interface Barber {
  id: string;
  name: string;
  avatarUrl?: string | null;
  specialties: string[];
}
interface Slot {
  startsAt: string;
  endsAt: string;
  barberId: string;
}
interface BookResult {
  appointmentId: string;
  manageToken: string;
  startsAt: string;
  barberName: string;
  totalPrice: number;
}
interface BookResponse extends Partial<BookResult> {
  requiresPayment?: boolean;
  checkoutUrl?: string;
}

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS = ["Servicio", "Barbero", "Hora", "Tus datos"];

async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : "Algo salió mal. Intenta de nuevo.";
    throw new Error(msg);
  }
  return data;
}

/** Réplica cliente de computeDeposit (lib/payments.ts importa Prisma, no se puede usar acá). */
function depositAmountFor(total: number, deposit?: DepositInfo | null): number {
  if (!deposit) return 0;
  if (deposit.type === "FIXED") return Math.min(Math.max(0, Math.round(deposit.value)), total);
  if (deposit.type === "PERCENT") {
    const pct = Math.min(100, Math.max(0, deposit.value));
    return Math.round((total * pct) / 100);
  }
  return 0;
}

export interface DepositInfo {
  type: "FIXED" | "PERCENT";
  value: number;
}

export function BookingWizard({
  slug,
  currency: _currency,
  timezone,
  presetServiceId,
  deposit,
  initialServices,
  initialBarbers,
  weekdaysByBarber,
}: {
  slug: string;
  currency: string;
  timezone: string;
  presetServiceId?: string;
  deposit?: DepositInfo | null;
  // Catálogo pre-resuelto por el Server Component (evita el fetch al montar).
  initialServices?: Service[];
  initialBarbers?: Barber[];
  // Días de la semana (0=dom) con horario por barbero: atenúa días cerrados.
  weekdaysByBarber?: Record<string, number[]>;
}) {
  const base = `/api/public/${slug}`;
  const minStep: Step = presetServiceId ? 1 : 0;
  const preloaded = !!(initialServices && initialBarbers);

  const [step, setStep] = useState<Step>(minStep);
  const [services, setServices] = useState<Service[]>(initialServices ?? []);
  const [barbers, setBarbers] = useState<Barber[]>(initialBarbers ?? []);
  const [catalog, setCatalog] = useState<"loading" | "ready" | "error">(
    preloaded ? "ready" : "loading",
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(
    presetServiceId ? [presetServiceId] : [],
  );
  const [barberChoice, setBarberChoice] = useState<string | "any" | null>(null);
  const [day, setDay] = useState<string | null>(null); // YYYY-MM-DD en TZ del local
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; phone?: string; email?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookResult | null>(null);
  const stepCardRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Carga inicial de servicios y barberos, con estado de error + reintento
  // (antes un fallo de red dejaba "Cargando servicios…" para siempre).
  async function loadCatalog() {
    setCatalog("loading");
    try {
      const [s, b] = await Promise.all([apiJson(`${base}/services`), apiJson(`${base}/barbers`)]);
      setServices(s.services);
      setBarbers(b.barbers);
      setCatalog("ready");
    } catch {
      setCatalog("error");
    }
  }
  useEffect(() => {
    if (!preloaded) void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // Al llegar al paso de hora, precarga las horas del primer día: antes el
  // cliente probaba día por día a ciegas ("No hay horas ese día" repetido).
  useEffect(() => {
    if (step !== 2 || day || !barberChoice) return;
    const first =
      openWeekdays === null
        ? days[0]
        : days.find((ymd) => openWeekdays.has(new Date(`${ymd}T12:00:00.000Z`).getUTCDay()));
    if (first) void loadSlots(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // El autoavance cambia el contenido bajo el dedo sin feedback: al cambiar de
  // paso llevamos el scroll y el foco al card (los lectores de pantalla quedaban
  // parados en un botón que ya no existe).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const el = stepCardRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, [step]);

  const fmtTime = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CL", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [timezone],
  );
  const fmtDayLong = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CL", {
        timeZone: timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [timezone],
  );

  const totals = useMemo(() => {
    const chosen = services.filter((s) => selectedServices.includes(s.id));
    return {
      price: chosen.reduce((a, s) => a + s.price, 0),
      duration: chosen.reduce((a, s) => a + s.durationMin, 0),
      names: chosen.map((s) => s.name),
    };
  }, [services, selectedServices]);

  const depositDue = useMemo(
    () => depositAmountFor(totals.price, deposit),
    [totals.price, deposit],
  );

  const barberLabel = useMemo(() => {
    if (barberChoice === "any") return "Cualquiera disponible";
    return barbers.find((b) => b.id === barberChoice)?.name ?? "";
  }, [barberChoice, barbers]);

  // Weekdays con atención para la elección actual ("any" = unión de todos).
  const openWeekdays = useMemo(() => {
    if (!weekdaysByBarber) return null; // sin dato: no atenuar nada
    const sets =
      barberChoice && barberChoice !== "any"
        ? [weekdaysByBarber[barberChoice] ?? []]
        : Object.values(weekdaysByBarber);
    return new Set(sets.flat());
  }, [weekdaysByBarber, barberChoice]);

  // Próximos 14 días como YYYY-MM-DD calculados en la TZ del LOCAL (no la del
  // dispositivo): un cliente en otra zona veía el número de día corrido.
  const days = useMemo(() => {
    const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    const [y, m, d] = todayYmd.split("-").map(Number);
    const out: string[] = [];
    for (let i = 0; i < 14; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
      out.push(dt.toISOString().slice(0, 10));
    }
    return out;
  }, [timezone]);

  // Selección única + autoavance al paso siguiente.
  function selectService(id: string) {
    setSelectedServices([id]);
    setDay(null);
    setSlots([]);
    setSlot(null);
    setStep(1);
  }

  function selectBarber(choice: string) {
    setBarberChoice(choice);
    setDay(null);
    setSlots([]);
    setSlot(null);
    setStep(2);
  }

  async function loadSlots(forDay: string) {
    setDay(forDay);
    setSlot(null);
    setLoadingSlots(true);
    try {
      const iso = `${forDay}T12:00:00.000Z`;
      const d = await apiJson(`${base}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId: barberChoice, date: iso, serviceIds: selectedServices }),
      });
      setSlots(d.slots);
    } catch (e) {
      toast.error((e as Error).message);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function validateForm(): boolean {
    const errs: typeof fieldErrors = {};
    if (!form.firstName.trim()) errs.firstName = "Ingresa tu nombre";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!phoneDigits) {
      errs.phone = "Ingresa tu teléfono para confirmarte la hora";
    } else if (phoneDigits.startsWith("56") && phoneDigits.length !== 11) {
      // Chile: +56 9 XXXX XXXX = 11 dígitos. Un número mal tecleado mata la
      // confirmación y los recordatorios por WhatsApp.
      errs.phone = "El número chileno debe tener 9 dígitos (ej: 9 1234 5678)";
    } else if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      errs.phone = "Ese número no parece válido — revísalo";
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      errs.email = "Ese email no parece válido";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!slot || submitting) return;
    if (!validateForm()) {
      // Lleva el foco al primer campo con error (en móvil el mensaje puede
      // quedar fuera del viewport y el submit parecía "no hacer nada").
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('#booking-form [aria-invalid="true"]');
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setSubmitting(true);
    try {
      const d: BookResponse = await apiJson(`${base}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: barberChoice,
          startsAt: slot.startsAt,
          serviceIds: selectedServices,
          client: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
          },
        }),
      });
      // Si la barbería cobra abono, vamos al checkout en vez de confirmar acá.
      if (d.requiresPayment && d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      setResult(d as BookResult);
      setStep(4);
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg);
      // Si otro cliente tomó la hora mientras llenaba sus datos, volvemos al
      // paso de hora y recargamos los cupos del día (antes quedaba estancado
      // en "Tus datos" con un slot muerto).
      if (/ocupad/i.test(msg) && day) {
        setSlot(null);
        setStep(2);
        void loadSlots(day);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Pantalla de confirmación ----
  if (step === 4 && result) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
          <CalendarCheck className="h-7 w-7 text-foreground" />
        </div>
        <h2 className="font-display text-xl font-medium">¡Reserva confirmada!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {fmtDayLong.format(new Date(result.startsAt))} a las {fmtTime.format(new Date(result.startsAt))} con{" "}
          {result.barberName}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Te enviamos la confirmación. Total: <strong className="text-foreground">{formatCLP(result.totalPrice)}</strong>
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link href={`/reservar/gestion/${result.manageToken}`}>Ver o modificar mi reserva</Link>
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Agendar otra hora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                i < step
                  ? "bg-accent/20 text-foreground"
                  : i === step
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-xs sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <div ref={stepCardRef} tabIndex={-1} className="rounded-lg border border-border bg-card p-5 focus:outline-none">
        {/* Catálogo: cargando / error con reintento (aplica a pasos 1 y 2) */}
        {catalog === "loading" && step <= 1 && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {catalog === "error" && (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No pudimos cargar la información. Revisa tu conexión.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadCatalog()}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Paso 1: servicios */}
        {step === 0 && catalog === "ready" && (
          <div className="space-y-2">
            <h2 className="mb-3 font-medium">¿Qué te vas a hacer?</h2>
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Este local aún no tiene servicios disponibles para reservar online.
              </p>
            )}
            {services.map((s) => {
              const active = selectedServices.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => selectService(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors",
                    active ? "border-foreground bg-accent/10" : "border-border hover:bg-muted",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Scissors className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDuration(s.durationMin)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatCLP(s.price)}</span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        active ? "border-foreground bg-foreground text-background" : "border-border",
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Paso 2: barbero */}
        {step === 1 && catalog === "ready" && (
          <div className="space-y-2">
            <h2 className="mb-3 font-medium">¿Con quién?</h2>
            <button
              onClick={() => selectBarber("any")}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
                barberChoice === "any" ? "border-foreground bg-accent/10" : "border-border hover:bg-muted",
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Cualquiera disponible</p>
                <p className="text-xs text-muted-foreground">Te asignamos al primero libre</p>
              </div>
            </button>
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBarber(b.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
                  barberChoice === b.id ? "border-foreground bg-accent/10" : "border-border hover:bg-muted",
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {b.avatarUrl ? (
                    <Image
                      src={b.avatarUrl}
                      alt={b.name}
                      width={36}
                      height={36}
                      sizes="36px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  {b.specialties.length > 0 && (
                    <p className="text-xs text-muted-foreground">{b.specialties.join(" · ")}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Paso 3: fecha y hora */}
        {step === 2 && (
          <div>
            <h2 className="mb-3 font-medium">Elige día y hora</h2>
            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((ymd) => {
                const active = day === ymd;
                const noon = new Date(`${ymd}T12:00:00.000Z`);
                const closed = openWeekdays !== null && !openWeekdays.has(noon.getUTCDay());
                return (
                  <button
                    key={ymd}
                    onClick={() => loadSlots(ymd)}
                    aria-pressed={active}
                    disabled={closed}
                    title={closed ? "Cerrado ese día" : undefined}
                    className={cn(
                      "flex min-h-[44px] shrink-0 flex-col items-center rounded-md border px-3 py-2 transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : closed
                          ? "cursor-not-allowed border-border opacity-35"
                          : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="text-[10px] uppercase">
                      {new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "short" }).format(noon)}
                    </span>
                    <span className="text-sm font-medium">{Number(ymd.slice(8, 10))}</span>
                  </button>
                );
              })}
            </div>

            {!day && <p className="text-sm text-muted-foreground">Selecciona un día para ver las horas.</p>}
            {day && loadingSlots && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando horas…
              </p>
            )}
            {day && !loadingSlots && slots.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay horas disponibles ese día. Prueba otro.</p>
            )}
            {day && !loadingSlots && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => {
                  const active = slot?.startsAt === s.startsAt;
                  return (
                    <button
                      key={s.startsAt}
                      onClick={() => {
                        setSlot(s);
                        setStep(3);
                      }}
                      className={cn(
                        "min-h-[44px] rounded-md border py-2 text-sm transition-colors",
                        active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                      )}
                    >
                      {fmtTime.format(new Date(s.startsAt))}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Paso 4: datos */}
        {step === 3 && (
          <form id="booking-form" className="space-y-4" onSubmit={submit} noValidate>
            <h2 className="font-medium">Tus datos</h2>
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {slot && fmtDayLong.format(new Date(slot.startsAt))} · {slot && fmtTime.format(new Date(slot.startsAt))}
                {barberLabel && <span>· {barberLabel}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {totals.names.join(" + ")} · {formatDuration(totals.duration)} · {formatCLP(totals.price)}
              </p>
              {depositDue > 0 && (
                <p className="mt-2 border-t border-border pt-2 text-xs text-foreground">
                  Para confirmar esta hora se paga un abono de{" "}
                  <strong>{formatCLP(depositDue)}</strong> con Webpay. El resto (
                  {formatCLP(Math.max(0, totals.price - depositDue))}) se paga en el local.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  aria-invalid={!!fieldErrors.firstName}
                  aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
                {fieldErrors.firstName && (
                  <p id="firstName-error" className="text-xs text-destructive">
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono (WhatsApp) *</Label>
              <PhoneInput
                id="phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
              />
              {fieldErrors.phone && (
                <p id="phone-error" className="text-xs text-destructive">
                  {fieldErrors.phone}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {fieldErrors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {fieldErrors.email}
                </p>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Navegación */}
      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => (s > minStep ? ((s - 1) as Step) : s))}
          disabled={step <= minStep}
        >
          <ChevronLeft className="h-4 w-4" /> Atrás
        </Button>
        {step === 3 && (
          <Button type="submit" form="booking-form" loading={submitting}>
            
            {depositDue > 0 ? `Continuar al pago (${formatCLP(depositDue)})` : "Confirmar reserva"}
          </Button>
        )}
      </div>
    </div>
  );
}
