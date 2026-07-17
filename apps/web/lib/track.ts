/**
 * Eventos de conversión hacia la analítica del tenant (GA4 / Meta Pixel),
 * inyectada por <TenantAnalytics /> en el sitio público. No-op si el tenant no
 * tiene analítica configurada (los globals no existen) o si un bloqueador de
 * anuncios los removió — nunca debe romper el flujo de reserva.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** Reserva confirmada en el wizard público. `value` en CLP. */
export function trackBookingConfirmed(data: { value: number }) {
  try {
    window.gtag?.("event", "reserva_confirmada", {
      currency: "CLP",
      value: data.value,
    });
    window.fbq?.("track", "Schedule", { currency: "CLP", value: data.value });
  } catch {
    // Analítica jamás rompe la reserva.
  }
}
