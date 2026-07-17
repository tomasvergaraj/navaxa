import { Card, Badge } from "@navaxa/ui";
import { MessageSquare, Lock } from "lucide-react";
import Link from "next/link";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { prisma, NotificationChannel, NotificationStatus } from "@navaxa/db";
import { subDays } from "date-fns";
import { formatRelative } from "@/lib/format";
import { planAllowsWhatsApp } from "@/lib/notifications/channel";
import { Automations } from "@/components/marketing/automations";
import { BroadcastDialog } from "@/components/marketing/broadcast-dialog";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  SMS: "SMS",
};

export default async function MarketingPage() {
  const { tenantId } = requireManagerPage();
  const db = scopedDb();
  const last30 = subDays(new Date(), 30);

  const [campaigns, logs, totals, tenant] = await Promise.all([
    db.campaign.findMany({ orderBy: { createdAt: "asc" }, take: 100 }),
    db.notificationLog.findMany({
      where: { createdAt: { gte: last30 } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.notificationLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: last30 } },
      _count: true,
    }),
    // Tenant no lleva columna tenantId → prisma directo, no scopedDb.
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }),
  ]);

  const totalsByStatus = Object.fromEntries(totals.map((t) => [t.status, t._count])) as Record<
    NotificationStatus,
    number
  >;
  const sent30 = (totalsByStatus.SENT ?? 0) + (totalsByStatus.DELIVERED ?? 0);
  const failed30 = totalsByStatus.FAILED ?? 0;

  const whatsappAvailable = tenant ? planAllowsWhatsApp(tenant.plan) : false;
  const canBroadcast = whatsappAvailable; // el envío manual es del plan PRO+

  const automationCampaigns = campaigns.map((c) => ({
    id: c.id,
    trigger: c.trigger,
    templateKey: c.templateKey,
    channel: c.channel,
    active: c.active,
    conditions: (c.conditions ?? null) as Record<string, unknown> | null,
  }));

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Campañas que mantienen vivos a tus clientes: en automático y a pedido.
        </p>
      </header>

      {/* Métricas */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Enviados 30d</div>
          <div className="mt-2 text-2xl font-medium tabular-nums">{sent30}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Fallidos 30d</div>
          <div className="mt-2 text-2xl font-medium tabular-nums">{failed30}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Automatizaciones activas
          </div>
          <div className="mt-2 text-2xl font-medium tabular-nums">
            {campaigns.filter((c) => c.active).length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Canal WhatsApp
          </div>
          <div className="mt-2 text-2xl font-medium">
            {whatsappAvailable ? (
              <Badge variant="success">Incluido</Badge>
            ) : (
              <Badge variant="outline">Plan Pro</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Automatizaciones */}
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Automatizaciones
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Se envían solas cuando corresponde. Actívalas y ajusta su canal.
      </p>
      <div className="mb-10">
        <Automations campaigns={automationCampaigns} whatsappAvailable={whatsappAvailable} />
      </div>

      {/* Envío manual */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${canBroadcast ? "mb-10" : "mb-4"}`}>
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Envío manual
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manda una promo o recordatorio a un grupo de clientes, ahora.
          </p>
        </div>
        {canBroadcast && <BroadcastDialog whatsappAvailable={whatsappAvailable} />}
      </div>
      {!canBroadcast && (
        <Card className="mb-10 flex flex-wrap items-center gap-3 border-dashed p-5 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">
            El envío manual a segmentos de clientes está en el plan Pro.
          </span>
          <Link
            href="/configuracion?tab=plan"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Ver planes
          </Link>
        </Card>
      )}

      {/* Últimos envíos */}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Últimos envíos
      </h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin envíos en los últimos 30 días.</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cuándo</th>
                  <th className="px-4 py-3 text-left font-medium">Canal</th>
                  <th className="px-4 py-3 text-left font-medium">Destinatario</th>
                  <th className="px-4 py-3 text-left font-medium">Plantilla</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-muted-foreground">{formatRelative(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        <MessageSquare className="mr-1 h-3 w-3" />
                        {CHANNEL_LABEL[l.channel]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{l.recipient}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.templateKey}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          l.status === NotificationStatus.FAILED
                            ? "destructive"
                            : l.status === NotificationStatus.PENDING
                              ? "warning"
                              : "success"
                        }
                        className="text-xs"
                      >
                        {l.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
