import { Check, CheckCheck, Play, UserX } from "lucide-react";
import { AppointmentStatus } from "@navaxa/db";

// Acciones de avance de estado en 1 toque, según el estado actual de la cita.
// Retroceder estados (casos raros) sigue disponible vía Editar > dropdown en el
// detalle. Compartido entre el dialog de detalle y el menú "⋮" de la grilla.
export type QuickAction = {
  to: AppointmentStatus;
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "outline";
  confirmMsg?: string;
};

export const QUICK_ACTIONS: Partial<Record<AppointmentStatus, QuickAction[]>> = {
  [AppointmentStatus.SCHEDULED]: [
    { to: AppointmentStatus.CONFIRMED, label: "Confirmar", icon: <Check className="h-4 w-4" /> },
    {
      to: AppointmentStatus.NO_SHOW,
      label: "No vino",
      icon: <UserX className="h-4 w-4" />,
      variant: "outline",
      confirmMsg: "¿Marcar que el cliente no vino?",
    },
  ],
  [AppointmentStatus.CONFIRMED]: [
    { to: AppointmentStatus.IN_PROGRESS, label: "Iniciar", icon: <Play className="h-4 w-4" /> },
    {
      to: AppointmentStatus.COMPLETED,
      label: "Completar",
      icon: <CheckCheck className="h-4 w-4" />,
      variant: "outline",
    },
    {
      to: AppointmentStatus.NO_SHOW,
      label: "No vino",
      icon: <UserX className="h-4 w-4" />,
      variant: "outline",
      confirmMsg: "¿Marcar que el cliente no vino?",
    },
  ],
  [AppointmentStatus.IN_PROGRESS]: [
    { to: AppointmentStatus.COMPLETED, label: "Completar", icon: <CheckCheck className="h-4 w-4" /> },
  ],
};

/** PATCH de estado. Lanza Error con mensaje legible si el servidor rechaza. */
export async function patchAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const res = await fetch(`/api/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "No se pudo actualizar");
  }
}
