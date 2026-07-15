"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Pencil, Trash2, ExternalLink, Clock, User, Scissors } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Textarea,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@navaxa/ui";
import { toast } from "sonner";
import { AppointmentStatus } from "@navaxa/db";
import { APPOINTMENT_STATUS_LABELS } from "@navaxa/config";
import type { GridBlock } from "@/lib/agenda";
import { formatCLP } from "@/lib/format";
import {
  QUICK_ACTIONS,
  patchAppointmentStatus,
  type QuickAction,
} from "@/components/agenda/appointment-quick-actions";

type Props = {
  block: GridBlock | null;
  onClose: () => void;
};

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: AppointmentStatus.SCHEDULED, label: APPOINTMENT_STATUS_LABELS.SCHEDULED },
  { value: AppointmentStatus.CONFIRMED, label: APPOINTMENT_STATUS_LABELS.CONFIRMED },
  { value: AppointmentStatus.IN_PROGRESS, label: APPOINTMENT_STATUS_LABELS.IN_PROGRESS },
  { value: AppointmentStatus.COMPLETED, label: APPOINTMENT_STATUS_LABELS.COMPLETED },
  { value: AppointmentStatus.NO_SHOW, label: APPOINTMENT_STATUS_LABELS.NO_SHOW },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AppointmentDetailDialog({ block, onClose }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [acting, setActing] = useState<AppointmentStatus | null>(null);

  const [status, setStatus] = useState<AppointmentStatus>(block?.status ?? AppointmentStatus.SCHEDULED);
  const [notes, setNotes] = useState<string>(block?.notes ?? "");

  // Resetear edición al cambiar de cita (o reabrir): adoptamos los valores actuales del bloque.
  useEffect(() => {
    if (block) {
      setStatus(block.status);
      setNotes(block.notes ?? "");
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id]);

  const open = block !== null;

  async function save() {
    if (!block) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (status !== block.status) body.status = status;
      if (notes.trim() !== (block.notes ?? "")) body.notes = notes.trim();
      if (Object.keys(body).length === 0) {
        setEditing(false);
        return;
      }
      const res = await fetch(`/api/appointments/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success("Cita actualizada");
      setEditing(false);
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function applyQuickAction(action: QuickAction) {
    if (!block || acting) return;
    if (action.confirmMsg && !confirm(action.confirmMsg)) return;
    setActing(action.to);
    try {
      await patchAppointmentStatus(block.id, action.to);
      toast.success(
        action.to === AppointmentStatus.COMPLETED
          ? "Cita completada"
          : `Cita: ${APPOINTMENT_STATUS_LABELS[action.to]}`,
      );
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function cancelAppointment() {
    if (!block) return;
    if (!confirm("¿Cancelar esta cita? Se notifica al cliente si está habilitado.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${block.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cancelar");
      toast.success("Cita cancelada");
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setEditing(false);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {block && (
          <>
            <DialogHeader>
              <DialogTitle>{block.clientName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <Row icon={<Clock className="h-4 w-4 text-muted-foreground" />}>
                <span className="tabular-nums">
                  {fmtTime(block.startsAtIso)}–{fmtTime(block.endsAtIso)}
                </span>
                <span className="text-muted-foreground"> · {block.barberName}</span>
              </Row>
              <Row icon={<Scissors className="h-4 w-4 text-muted-foreground" />}>
                <span>{block.serviceNames.join(", ") || "Sin servicios"}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {formatCLP(block.totalPrice)}
                </span>
              </Row>
              <Row icon={<User className="h-4 w-4 text-muted-foreground" />}>
                <Link
                  href={`/clientes/${block.clientId}`}
                  className="inline-flex items-center gap-1 text-foreground hover:underline"
                >
                  Ver ficha del cliente
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Row>

              {!editing && (
                <>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Estado
                    </div>
                    <div className="mt-0.5 text-sm font-medium">
                      {APPOINTMENT_STATUS_LABELS[block.status]}
                    </div>
                    {(QUICK_ACTIONS[block.status]?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {QUICK_ACTIONS[block.status]!.map((a) => (
                          <Button
                            key={a.to}
                            size="sm"
                            variant={a.variant ?? "default"}
                            onClick={() => applyQuickAction(a)}
                            disabled={acting !== null}
                          >
                            {acting === a.to ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              a.icon
                            )}
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {block.notes && (
                    <div className="rounded-md bg-muted/40 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Notas
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{block.notes}</p>
                    </div>
                  )}
                </>
              )}

              {editing && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <Select
                      value={status}
                      onValueChange={(v) => setStatus(v as AppointmentStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ad-notes">Notas</Label>
                    <Textarea
                      id="ad-notes"
                      rows={3}
                      maxLength={500}
                      placeholder="Notas internas de la cita"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para mover de hora o de barbero, arrastra el bloque en la grilla.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              {!editing ? (
                <>
                  {block.status !== AppointmentStatus.CANCELLED &&
                    block.status !== AppointmentStatus.COMPLETED && (
                      <Button
                        variant="ghost"
                        onClick={cancelAppointment}
                        disabled={cancelling || acting !== null}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                      >
                        {cancelling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Cancelar cita
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    disabled={acting !== null}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                    Descartar
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  );
}
