import type { MetadataRoute } from "next";
import { prisma } from "@navaxa/db";

// robots.txt ya anunciaba /sitemap.xml — antes daba 404.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://navaxa.cl";
  // Vitrinas públicas de cada barbería activa (SEO local del negocio).
  const tenants = await prisma.tenant.findMany({
    where: { active: true, bookingEnabled: true },
    select: { slug: true, updatedAt: true },
    take: 5000,
  });
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/precios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/legal`, changeFrequency: "yearly", priority: 0.2 },
    ...tenants.map((t) => ({
      url: `${base}/reservar/${t.slug}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
