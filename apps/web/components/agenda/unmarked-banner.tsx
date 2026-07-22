"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCheck, ChevronDown, ChevronUp, Loader2, UserX } from "lucide-react";
import { Button, cn } from "@navaxa/ui";
import { AppointmentStatus } from "@navaxa/db";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { patchAppointmentStatus } from "@/components/agenda/appointment-quick-actions";
import { formatCLP } from "@/lib/format";

export type UnmarkedItem = {
  id: string;
  when: string; // ya formateado en el server (ej: "lun 14 jul, 15:30")
  clientName: string;
  barberName: string;
  /** Saldo pendiente; se muestra como aviso para no cerrar la cita sin cobrar. */
  balance: number;
};

type Props = { items: UnmarkedItem[] };

/**
 * Banner "citas pasadas sin marcar": citas cuya hora ya pasó y siguen en
 * Agendada/Confirmada/En curso. El dueño decide una por una (o todas) si se
 * completaron o el cliente no vino — NUNCA se auto-completa a ciegas porque
 * COMPLETED dispara comisiones + invitación de reseña.
 */
export function UnmarkedBanner({ items }: Props) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  // Ocultamos localmente las ya resueltas para feedback inmediato (el refresh confirma).
  const [done, setDone] = useState<Set<string>>(new Set());

  const pending = items.filter((i) => !done.has(i.id));
  if (pending.length === 0) return null;

  async function markOne(id: string, status: AppointmentStatus) {
    if (actingId || bulkRunning) return;
    if (
      status === AppointmentStatus.NO_SHOW &&
      !(await confirm({
        title: "¿Marcar que el cliente no vino?",
        confirmText: "No vino",
        destructive: true,
      }))
    )
      return;
    setActingId(id);
    try {
      await patchAppointmentStatus(id, status);
      setDone((s) => new Set(s).add(id));
      toast.success(status === AppointmentStatus.COMPLETED ? "Cita completada" : "Marcada como no vino");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActingId(null);
    }
  }

  async function completeAll() {
    if (actingId || bulkRunning) return;
    const ok = await confirm({
      title: `¿Completar ${pending.length} cita(s)?`,
      description:
        "Esto registra las comisiones y envía la invitación de reseña a cada cliente. Si alguien no vino, márcalo individualmente antes.",
      confirmText: "Completar todas",
    });
    if (!ok) return;
    setBulkRunning(true);
    setBulkProgress(0);
    let done_ = 0;
    let failed = 0;
    // Secuencial a propósito: cada COMPLETED dispara comisiones + reseña en el server.
    for (const item of pending) {
      try {
        await patchAppointmentStatus(item.id, AppointmentStatus.COMPLETED);
        setDone((s) => new Set(s).add(item.id));
        done_++;
      } catch {
        failed++;
      }
      setBulkProgress(done_ + failed);
    }
    setBulkRunning(false);
    if (failed === 0) toast.success(`${done_} cita(s) completadas`);
    else toast.error(`${done_} completadas, ${failed} fallaron`);
    router.refresh();
  }

  return (
    <div className="mb-3 shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      {confirmDialog}
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-medium">
          {pending.length === 1
            ? "1 cita pasada sin marcar"
            : `${pending.length} citas pasadas sin marcar`}
        </span>
        <span className="hidden text-muted-foreground sm:inline">
          — márcalas como completadas o no vino.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={completeAll} disabled={bulkRunning || actingId !== null}>
            {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            {bulkRunning ? `Completando ${bulkProgress}/${pending.length + bulkProgress}…` : "Completar todas"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? "Ocultar" : "Ver"}
          </Button>
        </div>
      </div>

      {open && (
        <ul className="mt-2 divide-y divide-amber-500/20 border-t border-amber-500/20">
          {pending.map((i) => {
            const busy = bulkRunning || actingId === i.id;
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="tabular-nums text-muted-foreground">{i.when}</span>
                <span className="font-medium">{i.clientName}</span>
                <span className={cn("text-muted-foreground", "hidden sm:inline")}>· {i.barberName}</span>
                {i.balance > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800 dark:text-amber-200">
                    Saldo {formatCLP(i.balance)}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    disabled={busy || actingId !== null}
                    onClick={() => markOne(i.id, AppointmentStatus.COMPLETED)}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    Completar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-muted-foreground"
                    disabled={busy || actingId !== null}
                    onClick={() => markOne(i.id, AppointmentStatus.NO_SHOW)}
                  >
                    <UserX className="h-3.5 w-3.5" />
                    No vino
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
