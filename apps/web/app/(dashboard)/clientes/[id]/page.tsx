import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@navaxa/ui";
import { Phone, Mail, ArrowLeft } from "lucide-react";
import { APPOINTMENT_STATUS_LABELS } from "@navaxa/config";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { scopedDb } from "@/lib/tenant";
import { ownClientFilter } from "@/lib/page-guards";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { UploadPhotoDialog } from "@/components/upload-photo-dialog";
import { EditClientDialog } from "@/components/clients/edit-client-dialog";
import { HaircutGallery } from "@/components/clients/haircut-gallery";
import {
  formatCLP,
  formatDateTime,
  formatRelative,
} from "@/lib/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function ClientePage({ params }: PageProps) {
  const db = scopedDb();

  // Mismo alcance que la API by-id: un barbero no abre la ficha (nombre, teléfono,
  // historial) de un cliente que nunca atendió, aunque adivine el id.
  const scope = await ownClientFilter();

  const [client, barbers] = await Promise.all([
    db.client.findFirst({
      where: { id: params.id, ...scope },
      include: {
        preferences: true,
        haircuts: {
          orderBy: { performedAt: "desc" },
          take: 30,
        },
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 8,
          include: {
            barber: { include: { user: true } },
            services: { include: { service: true } },
          },
        },
      },
    }),
    db.barber.findMany({
      where: { active: true },
      include: { user: true },
    }),
  ]);

  if (!client) notFound();

  const fullName = `${client.firstName} ${client.lastName ?? ""}`.trim();
  const barbersList = barbers.map((b) => ({ id: b.id, name: b.user.name }));

  return (
    <div className="container max-w-7xl py-8">
      <Link
        href="/clientes"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a clientes
      </Link>

      {/* Header */}
      <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Cliente
          </div>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
            {fullName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {client.phone}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {client.email}
              </span>
            )}
            <span>· {client.totalVisits} visitas</span>
            <span>· {formatCLP(client.totalSpent)} gastado</span>
            {client.lastVisitAt && (
              <span>· última {formatRelative(client.lastVisitAt)}</span>
            )}
          </div>
          {client.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {client.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <EditClientDialog
            clientId={client.id}
            initial={{
              tags: client.tags,
              notes: client.notes ?? "",
              preferences: client.preferences,
            }}
            barbers={barbersList}
          />
          <UploadPhotoDialog
            clientId={client.id}
            clientPhone={client.phone}
            barbers={barbersList}
          />
          <NewAppointmentDialog presetClient={{ id: client.id, name: fullName }} label="Agendar hora" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Galería de cortes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Historial visual</h2>
            <span className="text-sm text-muted-foreground">
              {client.haircuts.length} corte{client.haircuts.length === 1 ? "" : "s"}
            </span>
          </div>

          <HaircutGallery
            clientId={client.id}
            photos={client.haircuts.map((h) => ({
              id: h.id,
              imageUrl: h.imageUrl,
              style: h.style,
              performedAt: h.performedAt,
              rating: h.rating,
            }))}
          />

          {/* Citas */}
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-medium">Citas</h2>
            {client.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin citas registradas.</p>
            ) : (
              <Card className="overflow-hidden">
<div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Fecha</th>
                      <th className="px-4 py-3 text-left font-medium">Barbero</th>
                      <th className="px-4 py-3 text-left font-medium">Servicios</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {client.appointments.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3">{formatDateTime(a.startsAt)}</td>
                        <td className="px-4 py-3">{a.barber.user.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {a.services.map((s) => s.service.name).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              a.status === "COMPLETED"
                                ? "success"
                                : a.status === "CANCELLED" || a.status === "NO_SHOW"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {APPOINTMENT_STATUS_LABELS[a.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCLP(a.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              </Card>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <AIRecommendationCard clientId={client.id} />

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-medium">Preferencias</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Tipo de pelo" value={client.preferences?.hairType} />
              <Row label="Estilo preferido" value={client.preferences?.preferredStyle} />
              <Row label="Fade" value={client.preferences?.fadeType} />
              <Row label="Largo arriba" value={client.preferences?.topLength} />
              <Row label="Barba" value={client.preferences?.beardStyle} />
              {client.preferences?.allergies && (
                <Row label="Alergias" value={client.preferences.allergies} highlight />
              )}
              {!client.preferences && (
                <p className="text-xs text-muted-foreground">
                  No hay preferencias registradas aún.
                </p>
              )}
            </dl>
          </Card>

          {client.notes && (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-medium">Notas</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {client.notes}
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          highlight
            ? "font-medium text-amber-700 dark:text-amber-400"
            : "font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}
