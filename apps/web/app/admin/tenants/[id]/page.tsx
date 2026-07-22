import Link from "next/link";
import { notFound } from "next/navigation";
import { startOfMonth } from "date-fns";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { Badge, Card } from "@navaxa/ui";
import { ArrowLeft } from "lucide-react";
import { formatCLP, formatDate, formatNumber } from "@/lib/format";
import { TenantAdminActions } from "@/components/admin/tenant-admin-actions";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { requireSuperAdminPage } from "@/lib/page-guards";

/** Últimas acciones mostradas en el detalle; el resto vive en /admin/audit. */
const AUDIT_PREVIEW = 10;

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function AdminTenantDetail({ params }: PageProps) {
  await requireSuperAdminPage();
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      subscription: true,
      users: {
        where: { role: "OWNER" },
        select: { id: true, name: true, email: true, lastLoginAt: true },
        take: 1,
      },
      _count: { select: { users: true, clients: true, barbers: true } },
    },
  });
  if (!tenant) notFound();

  const monthStart = startOfMonth(new Date());
  const [apptCount, monthRevenue, auditEntries] = await Promise.all([
    prisma.appointment.count({ where: { tenantId: tenant.id } }),
    prisma.appointment.aggregate({
      where: {
        tenantId: tenant.id,
        startsAt: { gte: monthStart },
        status: AppointmentStatus.COMPLETED,
      },
      _sum: { totalPrice: true },
    }),
    // Cae en el índice [targetType, targetId, createdAt] de AdminAuditLog.
    prisma.adminAuditLog.findMany({
      where: { targetType: "Tenant", targetId: params.id },
      orderBy: { createdAt: "desc" },
      take: AUDIT_PREVIEW,
    }),
  ]);

  const owner = tenant.users[0];

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </Link>

      <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Tenant /{tenant.slug}
          </div>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
            {tenant.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {tenant.city && <span>{tenant.city}</span>}
            {tenant.email && <span>· {tenant.email}</span>}
            {tenant.phone && <span>· {tenant.phone}</span>}
            <span>· creada {formatDate(tenant.createdAt)}</span>
          </div>
          {!tenant.active && (
            <Badge variant="outline" className="mt-2 border-rose-400 text-rose-600 dark:text-rose-300">
              Suspendida
            </Badge>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-medium">Métricas</h2>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Metric label="Usuarios" value={formatNumber(tenant._count.users)} />
              <Metric label="Barberos" value={formatNumber(tenant._count.barbers)} />
              <Metric label="Clientes" value={formatNumber(tenant._count.clients)} />
              <Metric label="Citas totales" value={formatNumber(apptCount)} />
              <Metric
                label="Ingreso del mes"
                value={formatCLP(monthRevenue._sum.totalPrice ?? 0)}
                wide
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-medium">Dueño</h2>
            {owner ? (
              <dl className="space-y-1 text-sm">
                <Row label="Nombre" value={owner.name} />
                <Row label="Email" value={owner.email} />
                <Row
                  label="Último login"
                  value={owner.lastLoginAt ? formatDate(owner.lastLoginAt) : "Nunca"}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Sin dueño registrado.</p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h2 className="text-sm font-medium">Acciones de plataforma</h2>
              {auditEntries.length > 0 && (
                <Link
                  href={`/admin/audit?target=${tenant.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Ver todo
                </Link>
              )}
            </div>
            <AuditLogTable
              entries={auditEntries}
              hideTarget
              emptyMessage="Nadie ha modificado esta barbería desde /admin."
            />
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-medium">Suscripción</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Plan" value={tenant.subscription?.plan ?? tenant.plan} />
              <Row label="Estado" value={tenant.subscription?.status ?? "—"} />
              <Row
                label="Vence"
                value={
                  tenant.subscription?.currentPeriodEnd
                    ? formatDate(tenant.subscription.currentPeriodEnd)
                    : "—"
                }
              />
              <Row label="Proveedor" value={tenant.subscription?.provider ?? "—"} />
              {tenant.subscription?.lastPaymentAt && (
                <Row label="Último pago" value={formatDate(tenant.subscription.lastPaymentAt)} />
              )}
            </dl>
          </Card>

          <TenantAdminActions
            tenantId={tenant.id}
            initial={{
              active: tenant.active,
              plan: tenant.subscription?.plan ?? tenant.plan,
              status: tenant.subscription?.status ?? null,
              currentPeriodEnd: tenant.subscription?.currentPeriodEnd?.toISOString() ?? null,
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
