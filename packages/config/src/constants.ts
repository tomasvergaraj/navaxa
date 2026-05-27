export const APP_NAME = "navaxa";
export const APP_TAGLINE = "Cortes que cuentan una historia";
export const APP_DESCRIPTION =
  "El sistema operativo para barberías que recuerdan a cada cliente";

export const SUPPORT_EMAIL = "contacto@navaxa.cl";

export const BRAND_COLORS = {
  graphite: "#0A0B0E",
  brass: "#C9A961",
  ivory: "#FAFAF7",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#2563EB",
} as const;

export const PLANS = {
  FREE: {
    id: "FREE",
    name: "Gratis",
    priceClp: 0,
    features: [
      "Hasta 50 clientes",
      "1 barbero",
      "Agenda básica",
      "Soporte por email",
    ],
    limits: { clients: 50, barbers: 1, photos: 100 },
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceClp: 19_990,
    features: [
      "Hasta 500 clientes",
      "Hasta 3 barberos",
      "CRM visual",
      "Recordatorios automáticos por email",
      "Analítica básica",
    ],
    limits: { clients: 500, barbers: 3, photos: 2_000 },
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceClp: 39_990,
    popular: true,
    features: [
      "Clientes ilimitados",
      "Hasta 10 barberos",
      "Recordatorios por WhatsApp",
      "IA: recomendación de corte",
      "Marketing automatizado",
      "Reportes avanzados",
      "Comisiones automatizadas",
    ],
    limits: { clients: Infinity, barbers: 10, photos: 20_000 },
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    priceClp: 89_990,
    features: [
      "Todo lo de Pro",
      "Multi-local",
      "Barberos ilimitados",
      "Integración con sistemas propios",
      "Soporte prioritario",
    ],
    limits: { clients: Infinity, barbers: Infinity, photos: Infinity },
  },
} as const;

export const WEEKDAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const APPOINTMENT_STATUS_LABELS = {
  PENDING_PAYMENT: "Pendiente de pago",
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelada",
} as const;

export const ROLE_LABELS = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  BARBER: "Barbero",
  STAFF: "Recepción",
} as const;
