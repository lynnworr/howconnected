import { getIndexableEditorialConnections } from "./editorial-connections.ts";

export const SITE_ORIGIN = "https://www.howconnected.app";

export const ROBOTS_RULES = {
  userAgent: "*",
  allow: ["/", "/connect/", "/explore", "/methodology", "/about", "/privacy", "/terms", "/contact"],
  disallow: ["/admin", "/api/"],
};

export const INDEXABLE_CONNECTIONS = getIndexableEditorialConnections().map(
  (connection) =>
    [connection.canonicalFromQid, connection.canonicalToQid] as const,
);

export const PUBLIC_PAGE_PATHS = [
  "/explore",
  "/methodology",
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

export function getIndexableUrls(): string[] {
  return [
    SITE_ORIGIN,
    ...PUBLIC_PAGE_PATHS.map((path) => `${SITE_ORIGIN}${path}`),
    ...INDEXABLE_CONNECTIONS.map(([fromQid, toQid]) =>
      getCanonicalConnectionUrl(fromQid, toQid),
    ),
  ];
}
