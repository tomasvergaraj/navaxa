"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Loader2, MapPin, Scissors, User, Wallet, X } from "lucide-react";
import { Button, cn } from "@navaxa/ui";
import { toast } from "sonner";
import { formatCLP } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Appointment {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  barberId: string;
  barberName: string;
  clientFirstName: string;
  totalPrice: number;
  durationMin: number;
  serviceIds: string[];
  services: { name: string; price: number }[];
  slug: string;
  shopName: string;
  address: string | null;
  timezone: string;
  deposit: { amount: number; status: string } | null;
}
interface Slot {
  startsAt: string;
  barberId: string;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "Pendiente de pago", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  SCHEDULED: { label: "Agendada", tone: "bg-accent/15 text-foreground" },
  CONFIRMED: { label: "Confirmada", tone: "bg-accent/15 text-foreground" },
  IN_PROGRESS: { label: "En curso", tone: "bg-muted text-foreground" },
  COMPLETED: { label: "Completada", tone: "bg-muted text-foreground" },
  NO_SHOW: { label: "No asistió", tone: "bg-destructive/10 text-destructive" },
  CANCELLED: { label: "Cancelada", tone: "bg-destructive/10 text-destructive" },
};

async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : "Algo salió mal. Intenta de nuevo.";
    throw new Error(msg);
  }
  return data;
}

// ---- Agregar al calendario ----
// ISO (UTC) → formato compacto iCal: 20260529T140000Z
function toICSDate(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function calendarTitle(a: Appointment): string {
  return `${a.services.map((s) => s.name).join(" + ")} — ${a.shopName}`;
}
function googleCalUrl(a: Appointment): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(a),
    dates: `${toICSDate(a.startsAt)}/${toICSDate(a.endsAt)}`,
    details: `Reserva con ${a.barberName}`,
    location: a.address ?? a.shopName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function downloadICS(a: Appointment) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//navaxa//reserva//ES",
    "BEGIN:VEVENT",
    `UID:${a.id}@navaxa.cl`,
    `DTSTART:${toICSDate(a.startsAt)}`,
    `DTEND:${toICSDate(a.endsAt)}`,
    `SUMMARY:${calendarTitle(a)}`,
    `DESCRIPTION:Reserva con ${a.barberName}`,
    `LOCATION:${(a.address ?? a.shopName).replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reserva.ics";
  link.click();
  URL.revokeObjectURL(url);
}

export function ManageBooking({ token }: { token: string }) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [working, setWorking] = useState(false);

  // Reagendar
  const [rescheduling, setRescheduling] = useState(false);
  const [day, setDay] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const d = await apiJson(`/api/public/manage/${token}`);
      setAppt(d.appointment);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fmt = useMemo(() => {
    const tz = appt?.timezone ?? "America/Santiago";
    return {
      dayLong: new Intl.DateTimeFormat("es-CL", {
        timeZone: tz,
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      time: new Intl.DateTimeFormat("es-CL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }),
      weekdayShort: new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "short" }),
    };
  }, [appt?.timezone]);

  const days = useMemo(() => {
    const out: Date[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(12, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, []);

  const canModify =
    appt &&
    (appt.status === "SCHEDULED" || appt.status === "CONFIRMED") &&
    new Date(appt.startsAt) > new Date();

  async function cancel() {
    const ok = await confirm({
      title: "Cancelar reserva",
      description: "¿Seguro que quieres cancelar tu hora? Esta acción no se puede deshacer.",
      confirmText: "Sí, cancelar",
      cancelText: "No",
      destructive: true,
    });
    if (!ok) return;
    setWorking(true);
    try {
      await apiJson(`/api/public/manage/${token}/cancel`, { method: "POST" });
      toast.success("Reserva cancelada");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function loadSlots(forDay: Date) {
    if (!appt) return;
    setDay(forDay);
    setLoadingSlots(true);
    try {
      const iso = `${forDay.getFullYear()}-${String(forDay.getMonth() + 1).padStart(2, "0")}-${String(
        forDay.getDate(),
      ).padStart(2, "0")}T12:00:00.000Z`;
      const d = await apiJson(`/api/public/${appt.slug}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId: appt.barberId, date: iso, serviceIds: appt.serviceIds }),
      });
      setSlots(d.slots);
    } catch (e) {
      toast.error((e as Error).message);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function reschedule(startsAt: string) {
    setWorking(true);
    try {
      await apiJson(`/api/public/manage/${token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }),
      });
      toast.success("Hora reagendada");
      setRescheduling(false);
      setDay(null);
      setSlots([]);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (notFound || !appt) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="font-display text-xl font-medium">Reserva no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El enlace no es válido o expiró. Si necesitas ayuda, contacta a la barbería.
        </p>
      </div>
    );
  }

  const status = STATUS_LABEL[appt.status] ?? { label: appt.status, tone: "bg-muted text-foreground" };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{appt.shopName}</p>
            <h1 className="font-display text-xl font-medium">Hola, {appt.clientFirstName}</h1>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", status.tone)}>{status.label}</span>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <p className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">{fmt.dayLong.format(new Date(appt.startsAt))}</span> ·{" "}
            {fmt.time.format(new Date(appt.startsAt))}–{fmt.time.format(new Date(appt.endsAt))}{" "}
            <span className="text-muted-foreground">({appt.durationMin} min)</span>
          </p>
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {appt.barberName}
          </p>
          <p className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-muted-foreground" />
            {appt.services.map((s) => s.name).join(" + ")} · {formatCLP(appt.totalPrice)}
          </p>
          {appt.address && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.address)}`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {appt.address}
              </a>
            </p>
          )}
        </div>

        {appt.address && (
          <iframe
            title={`Mapa de ${appt.shopName}`}
            className="mt-4 h-44 w-full rounded-md border border-border"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${encodeURIComponent(appt.address)}&output=embed`}
          />
        )}

        {appt.deposit && appt.deposit.status === "PAID" && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              Abono pagado <strong>{formatCLP(appt.deposit.amount)}</strong>
              {appt.totalPrice > appt.deposit.amount && (
                <>
                  {" · "}Saldo <strong>{formatCLP(appt.totalPrice - appt.deposit.amount)}</strong> en la barbería
                </>
              )}
            </span>
          </div>
        )}

        {appt.status !== "CANCELLED" && new Date(appt.startsAt) > new Date() && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <a
              href={googleCalUrl(appt)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <CalendarPlus className="h-4 w-4" /> Google Calendar
            </a>
            <button
              onClick={() => downloadICS(appt)}
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <CalendarPlus className="h-4 w-4" /> Descargar .ics
            </button>
          </div>
        )}

        {canModify && !rescheduling && (
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setRescheduling(true)} disabled={working}>
              Reagendar
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Cancelar
            </Button>
          </div>
        )}
        {!canModify && appt.status !== "CANCELLED" && (
          <p className="mt-6 text-xs text-muted-foreground">Esta reserva ya no se puede modificar en línea.</p>
        )}
      </div>

      {/* Panel de reagendar */}
      {rescheduling && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Elige nuevo día y hora</h2>
            <Button variant="ghost" size="sm" onClick={() => setRescheduling(false)}>
              Cancelar
            </Button>
          </div>
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const active = day && d.toDateString() === day.toDateString();
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => loadSlots(d)}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-md border px-3 py-2 transition-colors",
                    active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="text-[10px] uppercase">{fmt.weekdayShort.format(d)}</span>
                  <span className="text-sm font-medium">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
          {day && loadingSlots && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando horas…
            </p>
          )}
          {day && !loadingSlots && slots.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay horas disponibles ese día.</p>
          )}
          {day && !loadingSlots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.startsAt}
                  onClick={() => reschedule(s.startsAt)}
                  disabled={working}
                  className="rounded-md border border-border py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {fmt.time.format(new Date(s.startsAt))}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
