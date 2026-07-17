import type { CampaignTrigger } from "@navaxa/db";

/**
 * Metadata compartida de campañas (importable en cliente y servidor).
 * NO importa nada server-only: la usan tanto la UI de marketing como las
 * rutas API para validar y etiquetar.
 */

export interface AutomationCondition {
  field: string; // clave dentro del JSON `conditions` de la campaña
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
}

export interface AutomationDef {
  /** ID estable para la UI (no es el id de la fila). */
  key: string;
  trigger: CampaignTrigger;
  /** Identidad real: un trigger puede tener varias plantillas (recordatorios). */
  templateKey: string;
  name: string;
  description: string;
  /** Nombre por defecto al crear la campaña si el tenant no la tiene. */
  defaultName: string;
  condition?: AutomationCondition;
}

/**
 * Automatizaciones que un job realmente dispara respetando el flag `active`
 * de la campaña. Se excluye POST_VISIT a propósito: su plantilla
 * `thanks_post_visit` no tiene job que la envíe (el mensaje post-visita real
 * es la invitación a reseñar, que sale siempre al completar la cita), así que
 * mostrar un toggle para ella sería un control muerto.
 */
export const AUTOMATIONS: AutomationDef[] = [
  {
    key: "reminder_24h",
    trigger: "APPOINTMENT_REMINDER",
    templateKey: "reminder_24h",
    name: "Recordatorio 24 h antes",
    description: "Avisa al cliente el día previo a su cita y le pide confirmar.",
    defaultName: "Recordatorio 24h",
  },
  {
    key: "reminder_1h",
    trigger: "APPOINTMENT_REMINDER",
    templateKey: "reminder_1h",
    name: "Recordatorio 1 h antes",
    description: "Último aviso una hora antes, con la dirección del local.",
    defaultName: "Recordatorio 1h",
  },
  {
    key: "recall",
    trigger: "RECALL_INACTIVE",
    templateKey: "recall_30d",
    name: "Reactivación de inactivos",
    description: "Reengancha a los clientes que llevan tiempo sin volver.",
    defaultName: "Reactivación de inactivos",
    condition: {
      field: "daysSinceLastVisit",
      label: "Días sin venir",
      unit: "días",
      min: 15,
      max: 180,
      default: 30,
    },
  },
  {
    key: "birthday",
    trigger: "BIRTHDAY",
    templateKey: "birthday",
    name: "Saludo de cumpleaños",
    description: "Felicita el día del cumpleaños con un incentivo para volver.",
    defaultName: "Saludo de cumpleaños",
  },
];

export function findAutomation(templateKey: string): AutomationDef | undefined {
  return AUTOMATIONS.find((a) => a.templateKey === templateKey);
}

/** Plantillas admitidas en un envío manual (placeholders llenables para un segmento). */
export const BROADCAST_TEMPLATES = [
  {
    key: "recall_30d",
    label: "Invitación a volver",
    example: "Hace un tiempo que no nos vemos. Tenemos horas esta semana, reserva acá: …",
  },
  {
    key: "birthday",
    label: "Saludo con promo",
    example: "¡Feliz cumpleaños! Tienes 20% off en tu próximo corte.",
  },
  {
    key: "thanks_post_visit",
    label: "Agradecimiento",
    example: "Gracias por tu visita. ¿Qué tal quedó el corte?",
  },
] as const;

export type BroadcastTemplateKey = (typeof BROADCAST_TEMPLATES)[number]["key"];

export const BROADCAST_SEGMENTS = [
  { key: "all", label: "Todos los clientes con contacto", hasDays: false },
  { key: "inactive", label: "Clientes inactivos", hasDays: true },
  { key: "birthday_month", label: "Cumpleañeros de este mes", hasDays: false },
] as const;

export type BroadcastSegment = (typeof BROADCAST_SEGMENTS)[number]["key"];

/** Tope de destinatarios por envío manual (protege cupos y timeouts, COSTS.md). */
export const BROADCAST_MAX_RECIPIENTS = 500;

export const TRIGGER_LABEL: Record<CampaignTrigger, string> = {
  APPOINTMENT_REMINDER: "Recordatorio de cita",
  RECALL_INACTIVE: "Reactivación de inactivos",
  BIRTHDAY: "Cumpleaños",
  POST_VISIT: "Post-visita",
  MANUAL: "Envío manual",
};
