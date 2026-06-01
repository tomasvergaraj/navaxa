import Link from "next/link";
import { Card, Badge, Input } from "@navaxa/ui";
import { Search, Users } from "lucide-react";
import { NewClientButton } from "@/components/clients/new-client-button";
import { scopedDb } from "@/lib/tenant";
import { viewerScope } from "@/lib/page-guards";
import { EmptyState } from "@/components/empty-state";
import { formatCLP, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { q?: string };
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const db = scopedDb();
  const q = searchParams.q?.trim();
  // BARBER/STAFF: solo clientes que atendió (con cita propia). Gestión: todos.
  const { isManager, barberId } = await viewerScope();
  const ownFilter = isManager
    ? {}
    : { appointments: { some: { barberId: barberId ?? "__none__" } } };

  const clients = await db.client.findMany({
    where: {
      ...ownFilter,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } },
    take: 100,
    include: { _count: { select: { haircuts: true } } },
  });

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} cliente{clients.length === 1 ? "" : "s"} registrado
            {clients.length === 1 ? "" : "s"}
          </p>
        </div>
        <NewClientButton />
      </header>

      <form className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o teléfono"
            className="pl-9"
          />
        </div>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Sin resultados" : "Sin clientes aún"}
          description={
            q
              ? "Prueba con otro nombre o teléfono."
              : "Agrega tu primer cliente para empezar a construir su historial."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Contacto</th>
                <th className="px-4 py-3 text-left font-medium">Cortes</th>
                <th className="px-4 py-3 text-left font-medium">Gastado</th>
                <th className="px-4 py-3 text-left font-medium">Última visita</th>
                <th className="px-4 py-3 text-left font-medium">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.firstName} {c.lastName ?? ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.phone ?? c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c._count.haircuts}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCLP(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.lastVisitAt ? formatRelative(c.lastVisitAt) : "nunca"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
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
