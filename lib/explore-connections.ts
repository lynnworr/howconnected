import {
  getIndexableEditorialConnections,
  validateEditorialSnapshot,
} from "./editorial-connections.ts";
import { getCanonicalConnectionUrl } from "./seo.ts";

export type ExploreConnection = {
  slug: string;
  href: string;
  canonicalUrl: string;
  sourceName: string;
  targetName: string;
  description: string;
  verifiedAt: string;
  steps: number;
  path: readonly {
    name: string;
    relationship?: string;
  }[];
};

export const FEATURED_EXPLORE_CONNECTION_SLUG = "nasa-dwight-eisenhower";

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
        sourceName: snapshot.source.label,
        targetName: snapshot.target.label,
        description: snapshot.editorialExplanation,
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
