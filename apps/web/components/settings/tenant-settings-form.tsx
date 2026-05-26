"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Button, Input, Label, Textarea } from "@navaxa/ui";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { LogoUpload } from "@/components/settings/logo-upload";
import { CoverUpload } from "@/components/settings/cover-upload";
import { PhoneInput } from "@/components/ui/phone-input";

interface Tenant {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  instagram: string | null;
  website: string | null;
  rut: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  timezone: string;
  bookingEnabled: boolean;
  bookingNoticeMin: number;
}

const TIMEZONES = [
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/Montevideo",
];

const NOTICE_OPTIONS = [
  { value: 0, label: "Sin anticipación" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 día antes" },
];

export function TenantSettingsForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: tenant.name ?? "",
    rut: tenant.rut ?? "",
    phone: tenant.phone ?? "",
    email: tenant.email ?? "",
    address: tenant.address ?? "",
    city: tenant.city ?? "",
    timezone: tenant.timezone ?? "America/Santiago",
    description: tenant.description ?? "",
    instagram: tenant.instagram ?? "",
    website: tenant.website ?? "",
    bookingEnabled: tenant.bookingEnabled,
    bookingNoticeMin: tenant.bookingNoticeMin ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      toast.success("Cambios guardados");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const tzList = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <Label className="mb-2 block">Portada</Label>
        <CoverUpload coverUrl={tenant.coverUrl} />
      </div>

      <div className="border-b border-border pb-5">
        <Label className="mb-2 block">Logo</Label>
        <LogoUpload logoUrl={tenant.logoUrl} name={form.name || tenant.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-desc">Descripción</Label>
        <Textarea
          id="t-desc"
          rows={3}
          placeholder="Cuéntales a tus clientes sobre tu barbería…"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="RUT">
          <Input value={form.rut} onChange={(e) => set({ rut: e.target.value })} placeholder="76.543.210-K" />
        </Field>
        <Field label="Teléfono">
          <PhoneInput value={form.phone} onChange={(v) => set({ phone: v })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Dirección">
          <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="Ciudad">
          <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Zona horaria">
          <select
            value={form.timezone}
            onChange={(e) => set({ timezone: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tzList.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Instagram">
          <Input
            value={form.instagram}
            onChange={(e) => set({ instagram: e.target.value })}
            placeholder="@tubarberia"
          />
        </Field>
        <Field label="Sitio web">
          <Input
            value={form.website}
            onChange={(e) => set({ website: e.target.value })}
            placeholder="https://tubarberia.cl"
          />
        </Field>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-medium">Reservas online</h3>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Permitir reservas online</p>
            <p className="text-xs text-muted-foreground">
              Si lo desactivas, tu link de reservas deja de aceptar nuevas horas.
            </p>
          </div>
          <Switch
            checked={form.bookingEnabled}
            onChange={(v) => set({ bookingEnabled: v })}
            aria-label="Permitir reservas online"
          />
        </div>

        <div className="mt-3">
          <Label htmlFor="notice">Anticipación mínima para reservar</Label>
          <select
            id="notice"
            value={form.bookingNoticeMin}
            onChange={(e) => set({ bookingNoticeMin: Number(e.target.value) })}
            className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-72"
          >
            {NOTICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
