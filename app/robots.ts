import type { MetadataRoute } from "next";
import { ROBOTS_RULES, SITE_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: ROBOTS_RULES,
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
