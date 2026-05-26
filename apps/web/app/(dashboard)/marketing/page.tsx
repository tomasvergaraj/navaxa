import { Card, Badge, Button } from "@navaxa/ui";
import {
  MessageSquare,
  Clock,
  UserX,
  Gift,
  ThumbsUp,
  Send,
} from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import {
  CampaignTrigger,
  NotificationChannel,
  NotificationStatus,
} from "@navaxa/db";
import { subDays } from "date-fns";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<CampaignTrigger, string> = {
  APPOINTMENT_REMINDER: "Recordatorio de cita",
  RECALL_INACTIVE: "Reactivación de inactivos",
  BIRTHDAY: "Cumpleaños",
  POST_VISIT: "Post-visita",
  MANUAL: "Manual",
};

const TRIGGER_ICON: Record<CampaignTrigger, React.ComponentType<{ className?: string }>> = {
  APPOINTMENT_REMINDER: Clock,
  RECALL_INACTIVE: UserX,
  BIRTHDAY: Gift,
  POST_VISIT: ThumbsUp,
  MANUAL: Send,
};

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  SMS: "SMS",
};

export default async function MarketingPage() {
  const db = scopedDb();
  const last30 = subDays(new Date(), 30);

  const [campaigns, logs, totals] = await Promise.all([
    db.campaign.findMany({ orderBy: { createdAt: "asc" } }),
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
  ]);

  const totalsByStatus = Object.fromEntries(
    totals.map((t) => [t.status, t._count]),
  ) as Record<NotificationStatus, number>;

  const sent30 = (totalsByStatus.SENT ?? 0) + (totalsByStatus.DELIVERED ?? 0);
  const failed30 = totalsByStatus.FAILED ?? 0;

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Campañas automáticas que mantienen vivos a tus clientes.
        </p>
      </header>

      {/* Métricas */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Enviados 30d
          </div>
          <div className="mt-2 text-2xl font-medium tabular-nums">{sent30}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Fallidos 30d
          </div>
          <div className="mt-2 text-2xl font-medium tabular-nums">{failed30}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Campañas activas
          </div>
          <div className="mt-2 text-2xl font-medium tabular-nums">
            {campaigns.filter((c) => c.active).length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total campañas
          </div>
          <div className="mt-2 text-2xl font-medium tabular-nums">{campaigns.length}</div>
        </Card>
      </div>

      {/* Campañas */}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Campañas
      </h2>
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {campaigns.map((c) => {
          const Icon = TRIGGER_ICON[c.trigger];
          return (
            <Card key={c.id} className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/15">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {TRIGGER_LABEL[c.trigger]} · {CHANNEL_LABEL[c.channel]}
                    </p>
                  </div>
                </div>
                <Badge variant={c.active ? "success" : "outline"}>
                  {c.active ? "Activa" : "Pausada"}
                </Badge>
              </div>
              {c.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Últimos envíos */}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Últimos envíos
      </h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin envíos en los últimos 30 días.
        </p>
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatRelative(l.createdAt)}
                  </td>
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
