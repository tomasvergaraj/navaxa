import type { MetadataRoute } from "next";

// robots.txt ya anunciaba /sitemap.xml — antes daba 404.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://navaxa.cl";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/precios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/legal`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
