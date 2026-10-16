import { getIndexableEditorialConnections } from "./editorial-connections.ts";
import { isDailyPubliclyLaunched } from "./daily-puzzles.ts";

export const SITE_ORIGIN = "https://www.howconnected.app";

export const ROBOTS_RULES = {
  userAgent: "*",
  allow: ["/", "/connect/", "/daily", "/explore", "/methodology", "/extension", "/widgets", "/about", "/privacy", "/terms", "/contact"],
  disallow: ["/admin", "/api/"],
};

export const INDEXABLE_CONNECTIONS = getIndexableEditorialConnections().map(
  (connection) =>
    [connection.canonicalFromQid, connection.canonicalToQid] as const,
);

export const PUBLIC_PAGE_PATHS = [
  "/explore",
  "/methodology",
  "/extension",
  "/widgets",
  "/widgets/request",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
] as const;

export function getCanonicalConnectionUrl(
  fromQid: string,
  toQid: string,
): string {
  return `${SITE_ORIGIN}/connect/${encodeURIComponent(fromQid)}/${encodeURIComponent(toQid)}`;
}

export function getIndexableUrls(options: { dailyLaunchReady?: boolean } = {}): string[] {
  const dailyLaunchReady = options.dailyLaunchReady ?? isDailyPubliclyLaunched();
  return [
    SITE_ORIGIN,
    ...PUBLIC_PAGE_PATHS.map((path) => `${SITE_ORIGIN}${path}`),
    ...(dailyLaunchReady ? [`${SITE_ORIGIN}/daily`] : []),
    ...INDEXABLE_CONNECTIONS.map(([fromQid, toQid]) =>
      getCanonicalConnectionUrl(fromQid, toQid),
    ),
  ];
}
