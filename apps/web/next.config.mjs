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
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
