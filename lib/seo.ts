export const SITE_ORIGIN = "https://www.howconnected.app";

export const ROBOTS_RULES = {
  userAgent: "*",
  allow: ["/", "/connect/"],
  disallow: ["/admin", "/api/"],
};

export const INDEXABLE_CONNECTIONS = [
  ["Q19837", "Q8704"],
  ["Q19837", "Q127552"],
  ["Q19837", "Q312"],
  ["Q8704", "Q7414"],
  ["Q38222", "Q242446"],
  ["Q242446", "Q462"],
  ["Q265852", "Q312"],
  ["Q532423", "Q7414"],
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
    ...INDEXABLE_CONNECTIONS.map(([fromQid, toQid]) =>
      getCanonicalConnectionUrl(fromQid, toQid),
    ),
  ];
}
