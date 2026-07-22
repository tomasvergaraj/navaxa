/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@navaxa/ui", "@navaxa/config", "@navaxa/db"],
  images: {
    // En dev tras un proxy corporativo, el optimizador server-side de Next
    // recibe 403 al traer imágenes remotas (p.ej. Unsplash), aunque el
    // navegador sí puede. Desactivamos la optimización solo en desarrollo.
    unoptimized: process.env.NODE_ENV !== "production",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "cdn.navaxa.cl" },
      // Avatares de reseñas de Google (cache diario de Places API).
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    instrumentationHook: true,
  },
  // Headers de seguridad a nivel de app (siguen a la app aunque cambie el proxy;
  // en prod el edge es nginx, no Caddy). Deliberadamente NO fijamos default-src /
  // script-src estrictos acá: romperían la hidratación inline de Next y la carga de
  // imágenes remotas (R2/Unsplash/Google). El anti-clickjacking sí es seguro y
  // total. Un CSP script-src completo requiere nonces vía middleware (follow-up).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            // OJO con `form-action`: los checkouts de Webpay (/pagar,
            // /pagar/cita, /facturar y la compra de giftcard) hacen POST NATIVO
            // del formulario a
            // Transbank, así que con `'self'` a secas el navegador bloquea el
            // submit EN SILENCIO — el botón queda cargando para siempre y no
            // hay forma de pagar. Pasó exactamente eso entre el 2026-07-20 y el
            // 2026-07-22. Los dos hosts van listados: `webpay3g` es producción
            // y `webpay3gint` el sandbox de integración.
            value:
              "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; " +
              "form-action 'self' https://webpay3g.transbank.cl https://webpay3gint.transbank.cl",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
