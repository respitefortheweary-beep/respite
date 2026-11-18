import type { MetadataRoute } from "next";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import { siteUrl } from "@/lib/site";

// rebuilt at most once an hour, so new rooms reach Google and Bing without a redeploy
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl();
  const now = new Date();
  const [rooms, houses] = await Promise.all([getRoomsWithBeds().catch(() => []), getHouses().catch(() => [])]);

  const pages: MetadataRoute.Sitemap = [
    { url: `${url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${url}/rooms`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${url}/apply`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${url}/tour`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${url}/waitlist`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${url}/fair-housing`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${url}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const perHouse: MetadataRoute.Sitemap =
    houses.filter((h) => !h.hidden).length > 1
      ? houses.filter((h) => !h.hidden).map((h) => ({ url: `${url}/rooms?house=${encodeURIComponent(h.slug)}`, changeFrequency: "daily", priority: 0.8 }))
      : [];
  const perRoom: MetadataRoute.Sitemap = rooms
    .filter((r) => !r.hidden)
    .map((r) => ({ url: `${url}/rooms/${r.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.8 }));

  return [...pages, ...perHouse, ...perRoom];
}
