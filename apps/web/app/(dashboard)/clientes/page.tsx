import Link from "next/link";
import { Card, Badge, Input, Button } from "@navaxa/ui";
import { Search, Users } from "lucide-react";
import { NewClientButton } from "@/components/clients/new-client-button";
import { PageHeader } from "@/components/page-header";
import { scopedDb } from "@/lib/tenant";
import { viewerScope } from "@/lib/page-guards";
import { EmptyState } from "@/components/empty-state";
import { formatCLP, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { q?: string; page?: string };
}

const PAGE_SIZE = 50;

export default async function ClientesPage({ searchParams }: PageProps) {
  const db = scopedDb();
  const q = searchParams.q?.trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  // Solo el BARBER ve únicamente sus clientes atendidos. Gestión y recepción
  // (STAFF) ven todos los clientes del local.
  const { ownOnly, barberId } = await viewerScope();
  const ownFilter = ownOnly
    ? { appointments: { some: { barberId: barberId ?? "__none__" } } }
    : {};

  const where = {
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
  };

  // Paginado real + count: antes se truncaba a 100 en silencio y el header
  // mostraba "100 clientes" aunque hubiera más.
  const [clients, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { haircuts: true } } },
    }),
    db.client.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/clientes?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="container max-w-7xl py-8">
      <PageHeader
        className="mb-6"
        title="Clientes"
        subtitle={`${total} cliente${total === 1 ? "" : "s"} ${q ? "encontrado" : "registrado"}${total === 1 ? "" : "s"}`}
        action={<NewClientButton />}
      />

      <form className="mb-4 flex max-w-sm gap-2" role="search">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            aria-label="Buscar clientes por nombre o teléfono"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o teléfono"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
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

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {total} clientes
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page + 1)}>Siguiente</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Siguiente
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
