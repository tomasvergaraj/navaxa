"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@navaxa/ui";
import { toast } from "sonner";
import { TagsInput } from "@/components/ui/tags-input";

const empty = { name: "", email: "", commissionRate: "40", bio: "", specialties: [] as string[], instagram: "" };

export function NewBarberButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setForm(empty);
    setInviteUrl(null);
    setCopied(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/barbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          commissionRate: Number(form.commissionRate) / 100,
          bio: form.bio.trim() || undefined,
          specialties: form.specialties,
          instagram: form.instagram.trim().replace(/^@/, "") || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo crear");
      toast.success("Invitación enviada");
      setInviteUrl(typeof data?.inviteUrl === "string" ? data.inviteUrl : null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function close() {
    setOpen(false);
    reset();
  }

  const valid = form.name.trim() && /.+@.+\..+/.test(form.email);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Agregar barbero
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inviteUrl ? "Barbero invitado" : "Agregar barbero"}</DialogTitle>
          </DialogHeader>

          {inviteUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Le enviamos a <strong className="text-foreground">{form.email}</strong> un correo con
                un enlace para crear su contraseña. Si prefieres, compártele este enlace
                directamente (vence en 7 días):
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl} className="text-xs" onFocus={(e) => e.target.select()} />
                <Button variant="secondary" onClick={copyLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="b-name">Nombre</Label>
                <Input id="b-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-email">Email</Label>
                <Input id="b-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-comm">Comisión (%)</Label>
                <Input id="b-comm" type="number" min={0} max={100} value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-bio">Descripción (opcional)</Label>
                <Textarea
                  id="b-bio"
                  rows={2}
                  placeholder="Especialidad, estilo, experiencia…"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-spec">Especialidades (opcional)</Label>
                <TagsInput
                  id="b-spec"
                  value={form.specialties}
                  onChange={(specialties) => setForm({ ...form, specialties })}
                  placeholder="fade, barba, color… (Enter para agregar)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-ig">Instagram (opcional)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">@</span>
                  <Input
                    id="b-ig"
                    value={form.instagram}
                    placeholder="usuario"
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                El barbero recibirá un correo para crear su propia contraseña. No defines tú la clave.
              </p>
            </div>
          )}

          <DialogFooter>
            {inviteUrl ? (
              <Button onClick={close}>Listo</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={close}>Cancelar</Button>
                <Button onClick={save} disabled={saving || !valid}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
