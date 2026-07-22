"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Search, Star, MapPin, X, Lock } from "lucide-react";
import { Button, Input, Label, Textarea, NativeSelect } from "@navaxa/ui";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { LogoUpload } from "@/components/settings/logo-upload";
import { CoverUpload } from "@/components/settings/cover-upload";
import { PhoneInput } from "@/components/ui/phone-input";

interface Tenant {
  plan: string;
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
  googlePlaceId: string | null;
  googlePlaceName: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleMapsUri: string | null;
  bookingEnabled: boolean;
  bookingNoticeMin: number;
  gaMeasurementId: string | null;
  metaPixelId: string | null;
  brandColor: string | null;
  brandAccentColor: string | null;
  marketplaceVisible: boolean;
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
    googlePlaceId: tenant.googlePlaceId ?? "",
    bookingEnabled: tenant.bookingEnabled,
    bookingNoticeMin: tenant.bookingNoticeMin ?? 0,
    gaMeasurementId: tenant.gaMeasurementId ?? "",
    metaPixelId: tenant.metaPixelId ?? "",
    brandColor: tenant.brandColor ?? "",
    brandAccentColor: tenant.brandAccentColor ?? "",
    marketplaceVisible: tenant.marketplaceVisible,
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
          <NativeSelect
            value={form.timezone}
            onChange={(e) => set({ timezone: e.target.value })}
          >
            {tzList.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </NativeSelect>
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
        <h3 className="mb-1 text-sm font-medium">Reseñas de Google</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Vincula tu local de Google Maps para que tu página de reservas muestre tu puntuación y
          reseñas (se actualizan una vez al día).
        </p>
        <GooglePlacePicker
          value={form.googlePlaceId}
          onChange={(placeId) => set({ googlePlaceId: placeId })}
          tenant={tenant}
        />
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-1 text-sm font-medium">Analítica del sitio de reservas</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Mide visitas y reservas de tu página pública con tus propias cuentas de Google Analytics
          y Meta Pixel (para campañas de Instagram/Facebook).
        </p>
        {tenant.plan === "PRO" || tenant.plan === "ENTERPRISE" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Google Analytics (ID de medición)">
              <Input
                value={form.gaMeasurementId}
                onChange={(e) => set({ gaMeasurementId: e.target.value })}
                placeholder="G-XXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Meta Pixel (ID)">
              <Input
                value={form.metaPixelId}
                onChange={(e) => set({ metaPixelId: e.target.value })}
                placeholder="123456789012345"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Disponible en el plan Pro.{" "}
              <a href="/configuracion?tab=plan" className="font-medium underline hover:text-foreground">
                Ver planes
              </a>
            </span>
          </p>
        )}
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-1 text-sm font-medium">Colores de marca del sitio</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Pinta tu página de reservas con los colores de tu barbería: el principal va en los botones
          y el acento en los realces (opción elegida, estado de la reserva, fondo del logo). El texto
          se ajusta solo para que siempre se lea bien.
        </p>
        {tenant.plan === "PRO" || tenant.plan === "ENTERPRISE" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="color"
                aria-label="Color principal"
                value={/^#[0-9a-fA-F]{6}$/.test(form.brandColor) ? form.brandColor : "#0d0f13"}
                onChange={(e) => set({ brandColor: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <BrandPreview color={form.brandColor} />
              {form.brandColor && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ brandColor: "" })}>
                  <X className="h-4 w-4" />
                  Usar el principal de navaxa
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="color"
                aria-label="Color de acento"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(form.brandAccentColor)
                    ? form.brandAccentColor
                    : "#c9a961"
                }
                onChange={(e) => set({ brandAccentColor: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <AccentPreview color={form.brandAccentColor} />
              {form.brandAccentColor && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ brandAccentColor: "" })}
                >
                  <X className="h-4 w-4" />
                  Usar el acento de navaxa
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Disponible en el plan Pro.{" "}
              <a href="/configuracion?tab=plan" className="font-medium underline hover:text-foreground">
                Ver planes
              </a>
            </span>
          </p>
        )}
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div className="min-w-0 pr-3">
            <p className="text-sm font-medium">Aparecer en el directorio de navaxa</p>
            <p className="text-xs text-muted-foreground">
              Tu barbería se lista en la vitrina pública de navaxa para que nuevos clientes te
              encuentren. Tu link propio funciona igual si lo desactivas.
            </p>
          </div>
          <Switch
            checked={form.marketplaceVisible}
            onChange={(v) => set({ marketplaceVisible: v })}
            aria-label="Aparecer en el directorio de navaxa"
          />
        </div>
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
          <NativeSelect
            id="notice"
            value={form.bookingNoticeMin}
            onChange={(e) => set({ bookingNoticeMin: Number(e.target.value) })}
            className="mt-1.5 md:w-72"
          >
            {NOTICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
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

/** Vista previa del botón de reserva con el color elegido, con contraste AA. */
function BrandPreview({ color }: { color: string }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(color);
  const bg = valid ? color : undefined;
  // Luminancia relativa para elegir texto blanco o casi-negro (mismo criterio
  // que el server: siempre el de mayor contraste).
  const fg = (() => {
    if (!valid) return undefined;
    const [r, g, b] = [1, 3, 5].map((i) => {
      const s = parseInt(color.slice(i, i + 2), 16) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? "#fafaf8" : "#0d0f13";
  })();
  return (
    <span
      className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
      style={bg ? { backgroundColor: bg, color: fg } : undefined}
    >
      {valid ? "Reservar hora" : "Elige un color"}
    </span>
  );
}

function AccentPreview({ color }: { color: string }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(color);
  // El acento se usa siempre como tinte (bg-accent/15) con texto normal encima,
  // así que la muestra replica esa transparencia en vez del color plano.
  return (
    <span
      className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-foreground"
      style={valid ? { backgroundColor: `${color}26` } : undefined}
    >
      {valid ? "Reserva agendada" : "Elige un acento"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // El input va DENTRO del <label> (asociación implícita): lectores de pantalla
  // anuncian el campo con nombre y el tap en el texto enfoca el control, sin
  // tener que cablear htmlFor/id en cada uso.
  return (
    <Label className="block space-y-1.5">
      <span className="block">{label}</span>
      {children}
    </Label>
  );
}

interface PlaceResult {
  id: string;
  name: string;
  address: string;
}

/**
 * Vincular el local de Google Maps buscándolo por nombre, sin que el dueño
 * tenga que saber qué es un Place ID.
 */
function GooglePlacePicker({
  value,
  onChange,
  tenant,
}: {
  value: string;
  onChange: (placeId: string) => void;
  tenant: Tenant;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Datos del lugar elegido en esta sesión (antes de guardar, el server aún no los cacheó).
  const [picked, setPicked] = useState<PlaceResult | null>(null);

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      toast.error("Escribe al menos 3 caracteres");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/tenant/google-places?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo buscar");
      setResults(data.places ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    // El nombre viene de la selección en vivo o del cache del server tras guardar.
    const isSaved = value === tenant.googlePlaceId;
    const name = picked?.name ?? (isSaved ? tenant.googlePlaceName : null) ?? "Local vinculado";
    const address = picked?.address ?? null;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 md:max-w-xl">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {address ? (
            <p className="truncate text-xs text-muted-foreground">{address}</p>
          ) : isSaved && tenant.googleRating != null ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-current" />
              {tenant.googleRating.toFixed(1)} · {tenant.googleReviewCount ?? 0} reseñas
              {tenant.googleMapsUri && (
                <>
                  {" · "}
                  <a
                    href={tenant.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Ver en Google Maps
                  </a>
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isSaved ? "Vinculado" : "Guarda los cambios para vincularlo"}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange("");
            setPicked(null);
            setResults(null);
            setQuery("");
          }}
        >
          <X className="h-4 w-4" />
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:max-w-xl">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Busca tu barbería, ej: Barbería Don Juan, Providencia"
        />
        <Button type="button" variant="secondary" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
      </div>

      {results !== null &&
        (results.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin resultados. Prueba con el nombre tal como aparece en Google Maps más la comuna.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setPicked(p);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.address}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
