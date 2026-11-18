import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Private pages (dashboard, resident pay links, tour and waitlist links from emails) stay out of search
export default function robots(): MetadataRoute.Robots {
  if (process.env.SHOWCASE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/portal/", "/tour/", "/waitlist/", "/api/", "/feeds/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
