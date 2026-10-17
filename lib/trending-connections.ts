import {
  getApprovedExploreConnections,
  type ExploreConnection,
} from "./explore-connections.ts";
import {
  getUnrevealedPuzzleDisclosureConflicts,
  type EditorialPuzzleConflict,
} from "./editorial-connections.ts";

export type TrendingSignal = {
  editorialSlug: string;
  label: string;
  sourceTitle: string;
  sourceUrl: string;
  observedAt: string;
  startsAt: string;
  expiresAt: string;
};

export type TrendingConnection = ExploreConnection & {
  trendLabel: string;
  trendObservedAt: string;
  trendExpiresAt: string;
};

export type TrendingPublicationDecision =
  | { status: "public"; conflicts: readonly EditorialPuzzleConflict[] }
  | {
      status: "held";
      reason: "invalid-signal" | "missing-editorial" | "future-puzzle";
      conflicts: readonly EditorialPuzzleConflict[];
    };

export const MINIMUM_TRENDING_CARDS = 2;

// Trend signals are manually reviewed and deliberately separate from editorial
// evidence. Expiration affects homepage promotion, never the underlying page.
export const TRENDING_SIGNALS: readonly TrendingSignal[] = [
  {
    editorialSlug: "tesla-spacex",
    label: "Tesla Roadster demonstration",
    sourceTitle: "Tesla's new Roadster car can thrust itself in the air. But don't expect to drive it anytime soon",
    sourceUrl: "https://apnews.com/article/7d5f19665435b7408025bfb7a2f2f0b7",
    observedAt: "2026-10-16",
    startsAt: "2026-10-17T00:00:00.000Z",
    expiresAt: "2026-10-25T00:00:00.000Z",
  },
];

function hasValidSignalFields(signal: TrendingSignal): boolean {
  const startsAt = Date.parse(signal.startsAt);
  const expiresAt = Date.parse(signal.expiresAt);
  const observedAt = Date.parse(`${signal.observedAt}T00:00:00.000Z`);
  let sourceUrlIsSafe = false;
  try {
    const sourceUrl = new URL(signal.sourceUrl);
    sourceUrlIsSafe =
      sourceUrl.protocol === "https:" &&
      Boolean(sourceUrl.hostname) &&
      !sourceUrl.username &&
      !sourceUrl.password;
  } catch {
    sourceUrlIsSafe = false;
  }
  return (
    Boolean(signal.editorialSlug.trim()) &&
    Boolean(signal.label.trim()) &&
    Boolean(signal.sourceTitle.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(signal.observedAt) &&
    Number.isFinite(observedAt) &&
    Number.isFinite(startsAt) &&
    Number.isFinite(expiresAt) &&
    startsAt < expiresAt &&
    sourceUrlIsSafe
  );
}

function isActiveSignal(signal: TrendingSignal, now: Date): boolean {
  return (
    hasValidSignalFields(signal) &&
    Date.parse(signal.startsAt) <= now.getTime() &&
    now.getTime() < Date.parse(signal.expiresAt)
  );
}

function publicConnectionFields(connection: ExploreConnection): string[] {
  return [
    connection.slug,
    connection.href,
    connection.canonicalUrl,
    connection.sourceQid,
    connection.targetQid,
    connection.sourceName,
    connection.targetName,
    connection.headline,
    connection.category,
    connection.description,
    connection.verifiedAt,
    ...connection.path.flatMap(({ name, relationship }) => [name, relationship ?? ""]),
  ];
}

export function getTrendingPublicationDecision(
  signal: TrendingSignal,
  approvedConnections: readonly ExploreConnection[],
  options: { now?: Date; launchDate?: string | null } = {},
): TrendingPublicationDecision {
  if (!hasValidSignalFields(signal)) {
    return { status: "held", reason: "invalid-signal", conflicts: [] };
  }
  const connection = approvedConnections.find(({ slug }) => slug === signal.editorialSlug);
  if (!connection) {
    return { status: "held", reason: "missing-editorial", conflicts: [] };
  }
  const conflicts = getUnrevealedPuzzleDisclosureConflicts({
    qids: [connection.sourceQid, connection.targetQid],
    text: [
      signal.editorialSlug,
      signal.label,
      signal.sourceTitle,
      signal.sourceUrl,
      signal.observedAt,
      signal.startsAt,
      signal.expiresAt,
      ...publicConnectionFields(connection),
    ],
  }, options);
  if (conflicts.length > 0) {
    return { status: "held", reason: "future-puzzle", conflicts };
  }
  return { status: "public", conflicts: [] };
}

export function selectTrendingConnections(
  signals: readonly TrendingSignal[],
  approvedConnections: readonly ExploreConnection[],
  now = new Date(),
  minimumCards = MINIMUM_TRENDING_CARDS,
  launchDate: string | null | undefined = undefined,
): TrendingConnection[] {
  const approvedBySlug = new Map(
    approvedConnections.map((connection) => [connection.slug, connection]),
  );
  const selected = signals.flatMap((signal) => {
    if (!isActiveSignal(signal, now)) return [];
    const connection = approvedBySlug.get(signal.editorialSlug);
    if (!connection) return [];
    if (
      getTrendingPublicationDecision(signal, approvedConnections, { now, launchDate })
        .status !== "public"
    ) return [];
    return [{
      ...connection,
      href: `${connection.href}?source=trending_homepage`,
      trendLabel: signal.label,
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
