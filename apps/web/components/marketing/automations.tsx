"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, UserX, Gift, Loader2, Plus } from "lucide-react";
import { Card, Badge, Button, NativeSelect } from "@navaxa/ui";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { AUTOMATIONS, type AutomationDef } from "@/lib/campaigns";

interface Campaign {
  id: string;
  trigger: string;
  templateKey: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS";
  active: boolean;
  conditions: Record<string, unknown> | null;
}

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  reminder_24h: Clock,
  reminder_1h: Clock,
  recall: UserX,
  birthday: Gift,
};

async function apiJson(path: string, init: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
  return data;
}

export function Automations({
  campaigns,
  whatsappAvailable,
}: {
  campaigns: Campaign[];
  whatsappAvailable: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {AUTOMATIONS.map((def) => {
        const campaign = campaigns.find(
          (c) => c.trigger === def.trigger && c.templateKey === def.templateKey,
        );
        return (
          <AutomationCard
            key={def.key}
            def={def}
            campaign={campaign}
            whatsappAvailable={whatsappAvailable}
          />
        );
      })}
    </div>
  );
}

function AutomationCard({
  def,
  campaign,
  whatsappAvailable,
}: {
  def: AutomationDef;
  campaign?: Campaign;
  whatsappAvailable: boolean;
}) {
  const router = useRouter();
  const Icon = ICON[def.key] ?? Clock;
  const [busy, setBusy] = useState(false);

  const conditionValue =
    def.condition && campaign
      ? Number(campaign.conditions?.[def.condition.field] ?? def.condition.default)
      : def.condition?.default ?? 0;
  const [days, setDays] = useState(String(conditionValue));

  async function patch(body: Record<string, unknown>) {
    if (!campaign) return;
    setBusy(true);
    try {
      await apiJson(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      router.refresh(); // revierte el control optimista al estado real
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    try {
      await apiJson("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationKey: def.key }),
      });
      toast.success("Automatización activada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDays() {
    if (!campaign || !def.condition) return;
    const n = Number(days);
    if (Number.isNaN(n) || n === conditionValue) return;
    const clamped = Math.min(def.condition.max, Math.max(def.condition.min, n));
    setDays(String(clamped));
    await patch({ daysSinceLastVisit: clamped });
    toast.success("Guardado");
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/15">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-medium">{def.name}</h3>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {def.description}
            </p>
          </div>
        </div>
        {campaign ? (
          <div className="flex shrink-0 items-center gap-2">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Switch
              checked={campaign.active}
              disabled={busy}
              onChange={(v) => patch({ active: v })}
              aria-label={`Activar ${def.name}`}
            />
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={enable} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Activar
          </Button>
        )}
      </div>

      {campaign && (
        <div className="flex flex-wrap items-end gap-4 border-t border-border pt-4">
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">Canal</span>
            <NativeSelect
              value={campaign.channel === "WHATSAPP" ? "WHATSAPP" : "EMAIL"}
              disabled={busy}
              onChange={(e) => patch({ channel: e.target.value })}
              className="h-9 w-40"
            >
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">
                WhatsApp{whatsappAvailable ? "" : " (requiere Pro)"}
              </option>
            </NativeSelect>
          </label>

          {def.condition && (
            <label className="space-y-1.5 text-sm">
              <span className="block text-xs font-medium text-muted-foreground">
                {def.condition.label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={def.condition.min}
                max={def.condition.max}
                value={days}
                disabled={busy}
                onChange={(e) => setDays(e.target.value)}
                onBlur={saveDays}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          )}

          {!campaign.active && (
            <Badge variant="outline" className="mb-1.5">
              Pausada
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
