import type { MetadataRoute } from "next";
import { getIndexableUrls, SITE_ORIGIN } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return getIndexableUrls().map((url) => ({
    url,
    changeFrequency: url === SITE_ORIGIN ? "weekly" : "monthly",
    priority: url === SITE_ORIGIN ? 1 : 0.7,
  }));
}
