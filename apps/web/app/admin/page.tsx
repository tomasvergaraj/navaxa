import Link from "next/link";
import { prisma } from "@navaxa/db";
import { Badge, Card } from "@navaxa/ui";
import { ChevronRight } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSuperAdminPage } from "@/lib/page-guards";

export const dynamic = "force-dynamic";

const PLAN_COLOR: Record<string, string> = {
  FREE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  STARTER: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  PRO: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  ENTERPRISE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const STATUS_COLOR: Record<string, string> = {
  TRIALING: "border-sky-500 text-sky-700 dark:text-sky-300",
  ACTIVE: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
  PAST_DUE: "border-amber-500 text-amber-700 dark:text-amber-300",
  CANCELED: "border-zinc-400 text-zinc-700 dark:text-zinc-300",
};

const PAGE_SIZE = 50;

export default async function AdminIndex({ searchParams }: { searchParams: { page?: string } }) {
  await requireSuperAdminPage();
  const page = Math.max(1, Number(searchParams.page) || 1);
  // No usa scopedDb: el panel super admin opera cross-tenant. Paginado: la
  // lista crece con el negocio (regla COSTS.md).
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subscription: {
          select: { plan: true, status: true, currentPeriodEnd: true, provider: true },
        },
        _count: { select: { users: true, clients: true, appointments: true } },
      },
    }),
    prisma.tenant.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Barberías</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(total)} tenants registrados en la plataforma.
        </p>
      </header>

      <Card className="overflow-hidden">
<div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Barbería</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Suscripción</th>
              <th className="px-4 py-3 text-right font-medium">Usuarios</th>
              <th className="px-4 py-3 text-right font-medium">Clientes</th>
              <th className="px-4 py-3 text-right font-medium">Citas</th>
              <th className="px-4 py-3 text-left font-medium">Creada</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tenants.map((t) => {
              const plan = t.subscription?.plan ?? t.plan;
              const status = t.subscription?.status ?? "—";
              return (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">/{t.slug}</span>
                    </div>
                    {!t.active && (
                      <Badge variant="outline" className="mt-1 border-rose-400 text-rose-600 dark:text-rose-300">
                        Suspendida
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        PLAN_COLOR[plan] ?? PLAN_COLOR.FREE
                      }`}
                    >
                      {plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLOR[status] ?? ""}>
                      {status}
                    </Badge>
                    {t.subscription?.currentPeriodEnd && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        hasta {formatDate(t.subscription.currentPeriodEnd)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(t._count.users)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(t._count.clients)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(t._count.appointments)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                    >
                      Ver
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No hay barberías registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </Card>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin?page=${page - 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin?page=${page + 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
