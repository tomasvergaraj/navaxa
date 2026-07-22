import Link from "next/link";
import { formatDateTimeYear } from "@/lib/format";

/**
 * Tabla del rastro de auditoría de plataforma (`AdminAuditLog`).
 *
 * Server component sin estado: la usan tanto /admin/audit (listado completo con
 * filtros) como el detalle de tenant (últimas acciones sobre esa barbería).
 */

export interface AuditLogEntry {
  id: string;
  createdAt: Date;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent?: string | null;
}

/** Etiqueta legible por acción; el código crudo se muestra igual como fallback. */
const ACTION_LABEL: Record<string, string> = {
  "tenant.update": "Actualizó barbería",
};

export function AuditLogTable({
  entries,
  /** id de tenant → nombre, para no mostrar cuids pelados. */
  tenantNames,
  /** El detalle de tenant ya sabe de qué barbería habla: ahí sobra la columna. */
  hideTarget = false,
  emptyMessage = "Sin acciones registradas.",
}: {
  entries: AuditLogEntry[];
  tenantNames?: Map<string, string>;
  hideTarget?: boolean;
  emptyMessage?: string;
}) {
  const cols = hideTarget ? 4 : 5;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Cuándo</th>
            <th className="px-4 py-3 text-left font-medium">Actor</th>
            <th className="px-4 py-3 text-left font-medium">Acción</th>
            {!hideTarget && <th className="px-4 py-3 text-left font-medium">Objetivo</th>}
            <th className="px-4 py-3 text-left font-medium">Cambios</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((e) => (
            <tr key={e.id} className="align-top hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                <div>{formatDateTimeYear(e.createdAt)}</div>
                {e.ip && <div className="mt-0.5 tabular-nums opacity-70">{e.ip}</div>}
              </td>
              <td className="px-4 py-3">
                <span className="break-all">{e.actorEmail}</span>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</div>
                {ACTION_LABEL[e.action] && (
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {e.action}
                  </div>
                )}
              </td>
              {!hideTarget && (
                <td className="px-4 py-3">
                  <TargetCell entry={e} tenantNames={tenantNames} />
                </td>
              )}
              <td className="px-4 py-3">
                <Changes before={e.before} after={e.after} />
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TargetCell({
  entry,
  tenantNames,
}: {
  entry: AuditLogEntry;
  tenantNames?: Map<string, string>;
}) {
  if (entry.targetType === "Tenant") {
    const name = tenantNames?.get(entry.targetId);
    return (
      <Link href={`/admin/tenants/${entry.targetId}`} className="font-medium hover:underline">
        {/* El tenant puede haber sido borrado: el log sobrevive igual (sin FK). */}
        {name ?? `Tenant ${entry.targetId.slice(0, 8)}…`}
      </Link>
    );
  }
  return (
    <span className="text-muted-foreground">
      {entry.targetType} <span className="font-mono text-xs">{entry.targetId.slice(0, 8)}…</span>
    </span>
  );
}

/**
 * `before`/`after` guardan solo los campos tocados, con las mismas claves en
 * ambos lados (ver lib/audit.ts). Se listan como `campo: antes → después`.
 */
function Changes({ before, after }: { before: unknown; after: unknown }) {
  const b = asRecord(before);
  const a = asRecord(after);
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  if (keys.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {keys.map((k) => (
        <li key={k} className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-muted-foreground">{k}</span>
          <span className="line-through opacity-60">{display(b[k])}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">{display(a[k])}</span>
        </li>
      ))}
    </ul>
  );
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function display(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "string") return ISO_DATE.test(v) ? formatDateTimeYear(v) : v;
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}
