export type RecommendationSurface = "result" | "daily";
export type RecommendationReason =
  | "shared_endpoint"
  | "editorial_related"
  | "daily_relevant";

export type ConnectionRecommendationCandidate = {
  slug: string;
  href: string;
  sourceQid: string;
  targetQid: string;
  sourceName: string;
  targetName: string;
  headline: string;
  description: string;
  category: string;
  steps: number;
};

export type ConnectionRecommendation = ConnectionRecommendationCandidate & {
  reason: RecommendationReason;
  isEditorialRelated: boolean;
};

type RankedRecommendation = ConnectionRecommendation & {
  priority: number;
  originalIndex: number;
};

function normalizeQid(value: string): string {
  return value.trim().toUpperCase();
}

function isEquivalentPair(
  connection: ConnectionRecommendationCandidate,
  fromQid: string,
  toQid: string,
): boolean {
  const candidateFrom = normalizeQid(connection.sourceQid);
  const candidateTo = normalizeQid(connection.targetQid);
  return (
    (candidateFrom === fromQid && candidateTo === toQid) ||
    (candidateFrom === toQid && candidateTo === fromQid)
  );
}

export function createConnectionRecommendationCatalog(
  connections: readonly ConnectionRecommendationCandidate[],
): ConnectionRecommendationCandidate[] {
  return connections.map((connection) => ({
    slug: connection.slug,
    href: connection.href,
    sourceQid: connection.sourceQid,
    targetQid: connection.targetQid,
    sourceName: connection.sourceName,
    targetName: connection.targetName,
    headline: connection.headline,
    description: connection.description,
    category: connection.category,
    steps: connection.steps,
  }));
}

function selectDiverseRecommendations(
  ranked: readonly RankedRecommendation[],
  limit: number,
): ConnectionRecommendation[] {
  const selected: RankedRecommendation[] = [];
  const selectedSlugs = new Set<string>();
  const usedCategories = new Set<string>();
  const priorities = [...new Set(ranked.map(({ priority }) => priority))].sort(
    (left, right) => right - left,
  );

  for (const priority of priorities) {
    const tier = ranked
      .filter((item) => item.priority === priority)
      .sort((left, right) => left.originalIndex - right.originalIndex);
    for (const preferNewCategory of [true, false]) {
      for (const item of tier) {
        if (selected.length >= limit) break;
        if (selectedSlugs.has(item.slug)) continue;
        if (preferNewCategory && usedCategories.has(item.category)) continue;
        selected.push(item);
        selectedSlugs.add(item.slug);
        usedCategories.add(item.category);
      }
    }
    if (selected.length >= limit) break;
  }

  return selected.map((item) => ({
    slug: item.slug,
    href: item.href,
    sourceQid: item.sourceQid,
    targetQid: item.targetQid,
    sourceName: item.sourceName,
    targetName: item.targetName,
    headline: item.headline,
    description: item.description,
    category: item.category,
    steps: item.steps,
    reason: item.reason,
    isEditorialRelated: item.isEditorialRelated,
  }));
}

export function selectResultRecommendations(
  catalog: readonly ConnectionRecommendationCandidate[],
  rawFromQid: string,
  rawToQid: string,
  options: {
    preferredSlugs?: readonly string[];
    limit?: number;
  } = {},
): ConnectionRecommendation[] {
  const fromQid = normalizeQid(rawFromQid);
  const toQid = normalizeQid(rawToQid);
  const endpoints = new Set([fromQid, toQid]);
  const preferredSlugs = new Set(options.preferredSlugs ?? []);

  const ranked = catalog.flatMap((connection, originalIndex) => {
    if (isEquivalentPair(connection, fromQid, toQid)) return [];
    const sharedEndpointCount = [connection.sourceQid, connection.targetQid].filter(
      (qid) => endpoints.has(normalizeQid(qid)),
    ).length;
    const isEditorialRelated = preferredSlugs.has(connection.slug);
    if (sharedEndpointCount === 0 && !isEditorialRelated) return [];

    return [{
      ...connection,
      reason: sharedEndpointCount > 0 ? "shared_endpoint" as const : "editorial_related" as const,
      isEditorialRelated,
      priority: sharedEndpointCount > 0 ? 200 + sharedEndpointCount : 100,
      originalIndex,
    }];
  });

  return selectDiverseRecommendations(ranked, options.limit ?? 3);
}

export function selectDailyRecommendations(
  catalog: readonly ConnectionRecommendationCandidate[],
  puzzlePathQids: readonly string[],
  options: { limit?: number } = {},
): ConnectionRecommendation[] {
  const pathQids = new Set(puzzlePathQids.map(normalizeQid));
  const firstQid = normalizeQid(puzzlePathQids[0] ?? "");
  const lastQid = normalizeQid(puzzlePathQids.at(-1) ?? "");

  const ranked = catalog.flatMap((connection, originalIndex) => {
    if (isEquivalentPair(connection, firstQid, lastQid)) return [];
    const sharedNodeCount = [connection.sourceQid, connection.targetQid].filter(
      (qid) => pathQids.has(normalizeQid(qid)),
    ).length;
    if (sharedNodeCount === 0) return [];

    return [{
      ...connection,
      reason: "daily_relevant" as const,
      isEditorialRelated: false,
      priority: 100 + sharedNodeCount,
      originalIndex,
    }];
  });

  return selectDiverseRecommendations(ranked, options.limit ?? 2);
}
