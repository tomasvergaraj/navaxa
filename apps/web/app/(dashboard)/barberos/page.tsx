import { Card, Badge } from "@navaxa/ui";
import { UserPlus } from "lucide-react";
import { NewBarberButton } from "@/components/barbers/new-barber-button";
import { BarberAvatar } from "@/components/barbers/barber-avatar";
import { scopedDb } from "@/lib/tenant";
import { AppointmentStatus } from "@navaxa/db";
import { subDays } from "date-fns";
import { formatCLP, formatRelative } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function BarberosPage() {
  const db = scopedDb();
  const last30 = subDays(new Date(), 30);

  const barbers = await db.barber.findMany({
    where: { active: true },
    include: {
      user: { select: { name: true, email: true, lastLoginAt: true } },
      appointments: {
        where: {
          startsAt: { gte: last30 },
          status: AppointmentStatus.COMPLETED,
        },
        select: { totalPrice: true },
      },
      _count: { select: { appointments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const stats = barbers.map((b) => {
    const revenue = b.appointments.reduce((s, a) => s + a.totalPrice, 0);
    return {
      ...b,
      revenue,
      commission: Math.round(revenue * b.commissionRate),
      apptsCount: b.appointments.length,
    };
  });

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Barberos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {barbers.length} barbero{barbers.length === 1 ? "" : "s"} activo
            {barbers.length === 1 ? "" : "s"}
          </p>
        </div>
        <NewBarberButton />
      </header>

      {stats.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Sin barberos aún"
          description="Agrega a tu equipo para que puedan tomar citas y registrar sus cortes."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <BarberAvatar barberId={b.id} avatarUrl={b.avatarUrl} name={b.user.name} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">{b.user.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">{b.user.email}</p>
                </div>
              </div>

              {b.bio && (
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{b.bio}</p>
              )}

              {b.specialties.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {b.specialties.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Cortes 30d</div>
                  <div className="mt-1 font-medium tabular-nums">{b.apptsCount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Ingresos</div>
                  <div className="mt-1 font-medium tabular-nums">
                    {formatCLP(b.revenue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Comisión {Math.round(b.commissionRate * 100)}%
                  </div>
                  <div className="mt-1 font-medium tabular-nums">
                    {formatCLP(b.commission)}
                  </div>
                </div>
              </div>

              {b.user.lastLoginAt && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Última sesión {formatRelative(b.user.lastLoginAt)}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
