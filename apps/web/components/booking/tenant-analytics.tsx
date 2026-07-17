import Script from "next/script";

interface AnalyticsTenant {
  plan: string;
  gaMeasurementId: string | null;
  metaPixelId: string | null;
}

/**
 * Inyecta Google Analytics 4 y/o Meta Pixel del tenant en su sitio público.
 * Gate server-side: solo planes PRO+ (si el tenant bajó de plan, el ID puede
 * seguir guardado pero no se inyecta nada). Los IDs se re-validan acá con el
 * mismo formato del validador para nunca interpolar texto arbitrario en el
 * script, aunque la BD traiga un valor viejo o corrupto.
 */
export function TenantAnalytics({ tenant }: { tenant: AnalyticsTenant }) {
  if (tenant.plan !== "PRO" && tenant.plan !== "ENTERPRISE") return null;

  const gaId =
    tenant.gaMeasurementId && /^G-[A-Z0-9]{4,14}$/.test(tenant.gaMeasurementId)
      ? tenant.gaMeasurementId
      : null;
  const pixelId =
    tenant.metaPixelId && /^\d{5,20}$/.test(tenant.metaPixelId) ? tenant.metaPixelId : null;
  if (!gaId && !pixelId) return null;

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="navaxa-ga" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}
      {pixelId && (
        <Script id="navaxa-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
