import Link from "next/link";
import { prisma, Prisma } from "@navaxa/db";
import { Button, Card, Input } from "@navaxa/ui";
import { formatNumber } from "@/lib/format";
import { requireSuperAdminPage } from "@/lib/page-guards";
import { AuditLogTable } from "@/components/admin/audit-log-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  actor?: string;
  action?: string;
  target?: string;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperAdminPage();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const actor = searchParams.actor?.trim() ?? "";
  const action = searchParams.action?.trim() ?? "";
  const target = searchParams.target?.trim() ?? "";

  // `actorEmail contains` no tiene índice a propósito: /admin/audit lo mira solo
  // el operador y el filtro por defecto (orden por createdAt) sí lo usa. El
  // filtro por targetId cae en el índice compuesto [targetType, targetId, createdAt].
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(actor ? { actorEmail: { contains: actor, mode: "insensitive" } } : {}),
    ...(action ? { action } : {}),
    ...(target ? { targetId: target } : {}),
  };

  // Paginado siempre: el rastro solo crece (regla COSTS.md).
  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Nombres de los tenants de esta página en una sola query (el log guarda el id).
  const tenantIds = Array.from(
    new Set(entries.filter((e) => e.targetType === "Tenant").map((e) => e.targetId)),
  );
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      })
    : [];
  const tenantNames = new Map(tenants.map((t) => [t.id, t.name]));

  const hasFilters = Boolean(actor || action || target);
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (actor) sp.set("actor", actor);
    if (action) sp.set("action", action);
    if (target) sp.set("target", target);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Auditoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(total)} {total === 1 ? "acción registrada" : "acciones registradas"} desde el
          panel de plataforma{hasFilters ? " (con filtros)" : ""}.
        </p>
      </header>

      {/* GET plano: sin JS, los filtros quedan en la URL y son compartibles. */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Actor
          <Input
            name="actor"
            defaultValue={actor}
            placeholder="email del operador"
            className="h-9 w-56"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Acción
          <Input
            name="action"
            defaultValue={action}
            placeholder="tenant.update"
            className="h-9 w-48"
          />
        </label>
        {target && <input type="hidden" name="target" value={target} />}
        <Button type="submit" size="sm" variant="outline">
          Filtrar
        </Button>
        {hasFilters && (
          <Link
            href="/admin/audit"
            className="pb-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Limpiar
          </Link>
        )}
      </form>

      <Card className="overflow-hidden">
        <AuditLogTable
          entries={entries}
          tenantNames={tenantNames}
          emptyMessage={
            hasFilters
              ? "Ninguna acción coincide con el filtro."
              : "Todavía no hay acciones registradas."
          }
        />
      </Card>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={qs(page - 1)}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={qs(page + 1)}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
