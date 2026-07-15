"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus, UserX, UserCheck } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@navaxa/ui";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "BARBER" | "STAFF";
  active: boolean;
  barberId: string | null;
  commissionRate: number | null;
}

const ROLE_LABEL: Record<Member["role"], string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  BARBER: "Barbero",
  STAFF: "Staff",
};
const ROLES: Member["role"][] = ["OWNER", "ADMIN", "BARBER", "STAFF"];

async function apiJson(path: string, init: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
  return data;
}

export function TeamManager({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", commissionRate: "40", bio: "" });
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function patchMember(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await apiJson(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Equipo actualizado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveCommission(barberId: string, value: string, original: number) {
    const rate = Number(value) / 100;
    if (Number.isNaN(rate) || rate < 0 || rate > 1 || rate === original) return;
    setBusyId(barberId);
    try {
      await apiJson(`/api/barbers/${barberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rate }),
      });
      toast.success("Comisión actualizada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function createBarber() {
    setCreating(true);
    try {
      const data = await apiJson("/api/barbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          commissionRate: Number(form.commissionRate) / 100,
          bio: form.bio.trim() || undefined,
        }),
      });
      toast.success("Invitación enviada");
      setInviteUrl(typeof data?.inviteUrl === "string" ? data.inviteUrl : null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function closeDialog() {
    setOpen(false);
    setForm({ name: "", email: "", commissionRate: "40", bio: "" });
    setInviteUrl(null);
    setCopied(false);
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const validNew = form.name.trim() && /.+@.+\..+/.test(form.email);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-medium">Equipo ({members.length})</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Gestiona roles, comisiones y accesos.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Agregar barbero
        </Button>
      </div>

<div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Miembro</th>
            <th className="px-4 py-3 text-left font-medium">Rol</th>
            <th className="px-4 py-3 text-left font-medium">Comisión</th>
            <th className="px-4 py-3 text-right font-medium">Acceso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m) => {
            const isSelf = m.id === currentUserId;
            const busy = busyId === m.id || busyId === m.barberId;
            return (
              <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {m.name} {isSelf && <span className="text-xs text-muted-foreground">(tú)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td className="px-4 py-3">
                  {isSelf ? (
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  ) : (
                    <select
                      value={m.role}
                      disabled={busy}
                      aria-label={`Rol de ${m.name}`}
                      onChange={(e) => patchMember(m.id, { role: e.target.value })}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.barberId && m.commissionRate !== null ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`Comisión de ${m.name} (%)`}
                        defaultValue={Math.round(m.commissionRate * 100)}
                        disabled={busy}
                        onBlur={(e) => saveCommission(m.barberId!, e.target.value, m.commissionRate!)}
                        className="h-8 w-16"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isSelf ? (
                    <span className="text-xs text-muted-foreground">activo</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => patchMember(m.id, { active: !m.active })}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : m.active ? (
                        <>
                          <UserX className="h-4 w-4 text-destructive" /> Desactivar
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" /> Reactivar
                        </>
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
</div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inviteUrl ? "Barbero invitado" : "Agregar barbero"}</DialogTitle>
          </DialogHeader>

          {inviteUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Le enviamos a <strong className="text-foreground">{form.email}</strong> un correo con
                un enlace para crear su contraseña. También puedes compartirle este enlace
                directamente (vence en 7 días):
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl} className="text-xs" onFocus={(e) => e.target.select()} />
                <Button variant="secondary" onClick={copyInvite} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="t-name">Nombre</Label>
                <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-email">Email</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-comm">Comisión (%)</Label>
                <Input
                  id="t-comm"
                  type="number"
                  min={0}
                  max={100}
                  value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-bio">Descripción (opcional)</Label>
                <Textarea
                  id="t-bio"
                  rows={2}
                  placeholder="Especialidad, estilo, experiencia…"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El barbero recibirá un correo para crear su propia contraseña. No defines tú la clave.
              </p>
            </div>
          )}

          <DialogFooter>
            {inviteUrl ? (
              <Button onClick={closeDialog}>Listo</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button onClick={createBarber} disabled={creating || !validNew}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar invitación
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
