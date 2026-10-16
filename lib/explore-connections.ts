import {
  getIndexableEditorialConnections,
  validateEditorialSnapshot,
  type EditorialCategory,
} from "./editorial-connections.ts";
import { getCanonicalConnectionUrl } from "./seo.ts";

export type ExploreConnection = {
  slug: string;
  href: string;
  canonicalUrl: string;
  sourceQid: string;
  targetQid: string;
  sourceName: string;
  targetName: string;
  headline: string;
  category: EditorialCategory;
  description: string;
  verifiedAt: string;
  steps: number;
  path: readonly {
    name: string;
    relationship?: string;
  }[];
};

export const FEATURED_EXPLORE_CONNECTION_SLUG = "nasa-dwight-eisenhower";

export const HOMEPAGE_DISCOVERY_SLUGS = [
  "nasa-dwight-eisenhower",
  "studio-ghibli-hayao-miyazaki",
  "michael-jordan-chicago-bulls",
  "france-paris",
] as const;

export function getApprovedExploreConnections(
  now = new Date(),
): ExploreConnection[] {
  return getIndexableEditorialConnections(now).flatMap((connection) => {
    const validation = validateEditorialSnapshot(connection, now);
    if (validation.status !== "ready") return [];

    const { snapshot } = validation;
    const href = `/connect/${connection.canonicalFromQid}/${connection.canonicalToQid}`;

    return [
      {
        slug: connection.slug,
        href,
        canonicalUrl: getCanonicalConnectionUrl(
          connection.canonicalFromQid,
          connection.canonicalToQid,
        ),
        sourceQid: connection.canonicalFromQid,
        targetQid: connection.canonicalToQid,
        sourceName: snapshot.source.label,
        targetName: snapshot.target.label,
        headline:
          snapshot.headline ?? `${snapshot.source.label} and ${snapshot.target.label}`,
        category: connection.category,
        description: snapshot.introduction ?? snapshot.editorialExplanation,
        verifiedAt: connection.verifiedAt,
        steps: snapshot.path.steps,
        path: snapshot.path.nodes.map((node, index) => ({
          name: node.name,
          relationship: snapshot.path.relationships[index]?.label,
        })),
      },
    ];
  });
}

export function getFeaturedExploreConnection(
  connections: readonly ExploreConnection[],
): ExploreConnection | null {
  return (
    connections.find(
      ({ slug }) => slug === FEATURED_EXPLORE_CONNECTION_SLUG,
    ) ??
    connections[0] ??
    null
  );
}

export function getHomepageDiscoveryConnections(
  now = new Date(),
): ExploreConnection[] {
  const approved = new Map(
    getApprovedExploreConnections(now).map((connection) => [
      connection.slug,
      connection,
    ]),
  );

  return HOMEPAGE_DISCOVERY_SLUGS.flatMap((slug) => {
    const connection = approved.get(slug);
    return connection ? [connection] : [];
  });
}
