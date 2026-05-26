import { Card, Badge } from "@navaxa/ui";
import { Wallet } from "lucide-react";
import { scopedDb } from "@/lib/tenant";
import { formatCLP } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SettleButton } from "@/components/commissions/settle-button";

export const dynamic = "force-dynamic";

const MONTH_YEAR = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const METHOD_LABEL: Record<string, string> = {
  CASH: "efectivo",
  TRANSFER: "transferencia",
  OTHER: "otro",
};

type BarberAgg = {
  barberId: string;
  name: string;
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
  paidMethod: string | null;
};

type Period = {
  key: string;
  year: number;
  month: number; // 0-11
  label: string;
  pendingTotal: number;
  paidTotal: number;
  barbers: BarberAgg[];
};

export default async function ComisionesPage() {
  const db = scopedDb();

  const [grouped, barbers] = await Promise.all([
    db.commission.groupBy({
      by: ["periodStart", "barberId", "paid", "paymentMethod"],
      _sum: { amount: true },
      _count: true,
      orderBy: { periodStart: "desc" },
    }),
    db.barber.findMany({ select: { id: true, user: { select: { name: true } } } }),
  ]);

  const nameOf = new Map(barbers.map((b) => [b.id, b.user.name]));

  // Ensamblar: período (mes) → barbero → { pendiente, pagado }
  const periods = new Map<string, Period>();
  for (const row of grouped) {
    const d = row.periodStart;
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${month}`;

    let period = periods.get(key);
    if (!period) {
      period = {
        key,
        year,
        month,
        label: cap(MONTH_YEAR.format(new Date(year, month, 1))),
        pendingTotal: 0,
        paidTotal: 0,
        barbers: [],
      };
      periods.set(key, period);
    }

    let agg = period.barbers.find((b) => b.barberId === row.barberId);
    if (!agg) {
      agg = {
        barberId: row.barberId,
        name: nameOf.get(row.barberId) ?? "Barbero",
        pendingAmount: 0,
        pendingCount: 0,
        paidAmount: 0,
        paidCount: 0,
        paidMethod: null,
      };
      period.barbers.push(agg);
    }

    const sum = row._sum.amount ?? 0;
    if (row.paid) {
      agg.paidAmount += sum;
      agg.paidCount += row._count;
      if (row.paymentMethod) agg.paidMethod = row.paymentMethod;
      period.paidTotal += sum;
    } else {
      agg.pendingAmount += sum;
      agg.pendingCount += row._count;
      period.pendingTotal += sum;
    }
  }

  // Períodos más recientes primero (ya vienen ordenados, pero el Map preserva inserción);
  // dentro de cada período, mayor pendiente primero. Se acotan a los 12 últimos meses.
  const periodList = Array.from(periods.values()).slice(0, 12);
  for (const p of periodList) {
    p.barbers.sort((a, b) => b.pendingAmount - a.pendingAmount || a.name.localeCompare(b.name));
  }

  const totalPending = periodList.reduce((s, p) => s + p.pendingTotal, 0);

  return (
    <div className="container max-w-5xl py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">Comisiones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liquida a cada barbero el total de sus comisiones pendientes por mes.
          {totalPending > 0 && (
            <>
              {" "}
              Pendiente por pagar:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCLP(totalPending)}
              </span>
              .
            </>
          )}
        </p>
      </header>

      {periodList.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin comisiones aún"
          description="Las comisiones se generan automáticamente al completar citas. Aquí podrás liquidarlas."
        />
      ) : (
        <div className="space-y-6">
          {periodList.map((p) => (
            <Card key={p.key} className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-5 py-3">
                <h2 className="font-medium">{p.label}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {p.pendingTotal > 0 && (
                    <span>
                      Pendiente{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCLP(p.pendingTotal)}
                      </span>
                    </span>
                  )}
                  {p.paidTotal > 0 && (
                    <span>
                      Pagado{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCLP(p.paidTotal)}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <ul className="divide-y divide-border">
                {p.barbers.map((b) => {
                  const cortes = b.pendingCount + b.paidCount;
                  const fullyPaid = b.pendingAmount === 0 && b.paidAmount > 0;
                  return (
                    <li
                      key={b.barberId}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{b.name}</span>
                          {fullyPaid && (
                            <Badge variant="outline" className="text-[10px]">
                              Liquidado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {cortes} corte{cortes === 1 ? "" : "s"}
                          {b.pendingAmount > 0 && (
                            <>
                              {" · "}pendiente{" "}
                              <span className="tabular-nums text-foreground">
                                {formatCLP(b.pendingAmount)}
                              </span>
                            </>
                          )}
                          {b.paidAmount > 0 && (
                            <>
                              {" · "}pagado{" "}
                              <span className="tabular-nums">{formatCLP(b.paidAmount)}</span>
                              {b.paidMethod && ` (${METHOD_LABEL[b.paidMethod] ?? b.paidMethod})`}
                            </>
                          )}
                        </p>
                      </div>
                      <SettleButton
                        barberId={b.barberId}
                        year={p.year}
                        month={p.month}
                        pendingAmount={b.pendingAmount}
                        paidAmount={b.paidAmount}
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
