import type { MetadataRoute } from "next";
import { getHouses } from "@/lib/availability";
import { siteUrl } from "@/lib/site";
import { PROGRAMS } from "@/lib/programs";

// rebuilt at most once an hour, so new houses reach Google and Bing without a redeploy
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl();
  const now = new Date();
  const houses = await getHouses().catch(() => []);

  const pages: MetadataRoute.Sitemap = [
    { url: `${url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${url}/houses`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...PROGRAMS.map((p) => ({ url: `${url}${p.path}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: `${url}/apply`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${url}/tour`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${url}/waitlist`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${url}/fair-housing`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${url}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const perHouse: MetadataRoute.Sitemap = houses
    .filter((h) => !h.hidden)
    .map((h) => ({ url: `${url}/houses/${h.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.8 }));

  return [...pages, ...perHouse];
}
