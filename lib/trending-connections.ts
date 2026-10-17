import {
  getApprovedExploreConnections,
  type ExploreConnection,
} from "./explore-connections.ts";

export type TrendingSignal = {
  editorialSlug: string;
  label: string;
  sourceUrl: string;
  observedAt: string;
  startsAt: string;
  expiresAt: string;
};

export type TrendingConnection = ExploreConnection & {
  trendLabel: string;
  trendSourceUrl: string;
  trendObservedAt: string;
  trendExpiresAt: string;
};

export const MINIMUM_TRENDING_CARDS = 2;

// Trend signals are manually reviewed and deliberately separate from editorial
// evidence. Expiration affects homepage promotion, never the underlying page.
export const TRENDING_SIGNALS: readonly TrendingSignal[] = [
  {
    editorialSlug: "tesla-spacex",
    label: "Tesla Roadster demonstration",
    sourceUrl: "https://apnews.com/article/7d5f19665435b7408025bfb7a2f2f0b7",
    observedAt: "2026-10-16",
    startsAt: "2026-10-17T00:00:00.000Z",
    expiresAt: "2026-10-25T00:00:00.000Z",
  },
];

function isActiveSignal(signal: TrendingSignal, now: Date): boolean {
  const startsAt = Date.parse(signal.startsAt);
  const expiresAt = Date.parse(signal.expiresAt);
  return (
    Number.isFinite(startsAt) &&
    Number.isFinite(expiresAt) &&
    startsAt <= now.getTime() &&
    now.getTime() < expiresAt &&
    signal.sourceUrl.startsWith("https://")
  );
}

export function selectTrendingConnections(
  signals: readonly TrendingSignal[],
  approvedConnections: readonly ExploreConnection[],
  now = new Date(),
  minimumCards = MINIMUM_TRENDING_CARDS,
): TrendingConnection[] {
  const approvedBySlug = new Map(
    approvedConnections.map((connection) => [connection.slug, connection]),
  );
  const selected = signals.flatMap((signal) => {
    if (!isActiveSignal(signal, now)) return [];
    const connection = approvedBySlug.get(signal.editorialSlug);
    if (!connection) return [];
    return [{
      ...connection,
      href: `${connection.href}?source=trending_homepage`,
      trendLabel: signal.label,
      trendSourceUrl: signal.sourceUrl,
      trendObservedAt: signal.observedAt,
      trendExpiresAt: signal.expiresAt.slice(0, 10),
    }];
  });
  return selected.length >= minimumCards ? selected : [];
}

export function getHomepageTrendingConnections(
  now = new Date(),
): TrendingConnection[] {
  return selectTrendingConnections(
    TRENDING_SIGNALS,
    getApprovedExploreConnections(now),
    now,
  );
}
