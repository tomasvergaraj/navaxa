import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

interface Props {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | null;
  trialEndsAt: Date | null;
  plan: string;
}

const DAY = 24 * 60 * 60 * 1000;

function fmt(d: Date): string {
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

/**
 * Avisos de facturación en el dashboard. Solo aparece en estados que requieren
 * atención: pago vencido o prueba por terminar / terminada en plan Gratis.
 */
export function SubscriptionBanner({ status, trialEndsAt, plan }: Props) {
  const now = Date.now();

  if (status === "PAST_DUE") {
    return (
      <Bar tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>
        Tu pago está pendiente. Renueva para no perder tu plan.{" "}
        <Action>Renovar</Action>
      </Bar>
    );
  }

  // Prueba (solo si no hay plan pagado activo).
  if (status !== "ACTIVE" && trialEndsAt) {
    const ends = trialEndsAt.getTime();
    const daysLeft = Math.ceil((ends - now) / DAY);
    if (ends > now && daysLeft <= 7) {
      return (
        <Bar tone="warning" icon={<Clock className="h-4 w-4" />}>
          Tu prueba termina el {fmt(trialEndsAt)} ({daysLeft} {daysLeft === 1 ? "día" : "días"}). Elige un plan para
          seguir sin interrupciones. <Action>Ver planes</Action>
        </Bar>
      );
    }
    if (ends <= now && plan === "FREE") {
      return (
        <Bar tone="muted" icon={<Clock className="h-4 w-4" />}>
          Tu prueba terminó y estás en el plan Gratis. <Action>Mejora tu plan</Action>
        </Bar>
      );
    }
  }

  return null;
}

function Bar({
  tone,
  icon,
  children,
}: {
  tone: "danger" | "warning" | "muted";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700"
        : "bg-muted text-muted-foreground";
  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-sm ${toneCls}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function Action({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/configuracion?tab=plan" className="font-medium underline underline-offset-2">
      {children}
    </Link>
  );
}
