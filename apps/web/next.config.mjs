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
      { protocol: "https", hostname: "cdn.navaxa.app" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    instrumentationHook: true,
  },
};

export default nextConfig;
