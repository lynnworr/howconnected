import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getIndexableUrls, SITE_ORIGIN } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return getIndexableUrls({ now: new Date() }).map((url) => ({
    url,
    changeFrequency: url === SITE_ORIGIN ? "weekly" : "monthly",
    priority: url === SITE_ORIGIN ? 1 : 0.7,
  }));
}
