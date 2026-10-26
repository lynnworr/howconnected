import type {
  DiscoveryResult,
  SelectedEntity,
} from "../components/connection-types.ts";
import {
  findEditorialConnection,
  getEditorialPublicationDecision,
  getRelatedEditorialConnections,
  snapshotToDiscoveryResult,
  validateEditorialSnapshot,
  type EditorialCategory,
  type EditorialSource,
  type EditorialConnection,
} from "./editorial-connections.ts";

export type EditorialPageDetails = {
  slug: string;
  headline: string;
  introduction: string;
  relationshipMeaning: string;
  context: readonly string[];
  limitations: readonly string[];
  verificationSources: readonly EditorialSource[];
  category: EditorialCategory;
  verifiedAt: string;
  pathFingerprint: string;
  explanation: string;
  indexEligible: boolean;
  reviewStatus: "approved" | "needs-review" | "rejected";
  related: readonly {
    slug: string;
    href: string;
    headline: string;
    description: string;
    category: EditorialCategory;
    verifiedAt: string;
    sourceName: string;
    targetName: string;
  }[];
};

export type ConnectionPageData =
  | { status: "invalid" }
  | { status: "error" }
  | {
      status: "editorial-unavailable";
      reason: "missing" | "invalid" | "stale";
    }
  | {
      status: "same";
      source: SelectedEntity;
      target: SelectedEntity;
    }
  | {
      status: "success" | "empty";
      source: SelectedEntity;
      target: SelectedEntity;
      result: DiscoveryResult;
      editorial?: EditorialPageDetails;
    };

export function resolveEditorialSnapshotPageData(
  connection: EditorialConnection,
  now = new Date(),
): ConnectionPageData {
  const publication = getEditorialPublicationDecision(connection, { now });
  const validation = publication.validation;
  if (publication.status !== "public") {
    return { status: "editorial-unavailable", reason: validation.status === "ready" ? "missing" : validation.status };
  }
  if (validation.status !== "ready") {
    return { status: "editorial-unavailable", reason: validation.status };
  }

  return {
    status: "success",
    source: validation.snapshot.source,
    target: validation.snapshot.target,
    result: snapshotToDiscoveryResult(validation.snapshot),
    editorial: {
      slug: connection.slug,
      headline:
        validation.snapshot.headline ??
        `${validation.snapshot.source.label} and ${validation.snapshot.target.label}`,
      introduction:
        validation.snapshot.introduction ?? validation.snapshot.editorialExplanation,
      relationshipMeaning:
        validation.snapshot.relationshipMeaning ??
        validation.snapshot.editorialExplanation,
      context: validation.snapshot.context ?? [],
      limitations: validation.snapshot.limitations ?? [],
      verificationSources: validation.snapshot.verificationSources ?? [],
      category: connection.category,
      verifiedAt: connection.verifiedAt,
      pathFingerprint: connection.pathFingerprint,
      explanation: validation.snapshot.editorialExplanation,
      indexEligible: connection.indexEligible,
      reviewStatus: connection.reviewStatus,
      related: getRelatedEditorialConnections(connection, now).flatMap((related) => {
        const relatedValidation = validateEditorialSnapshot(related, now);
        if (relatedValidation.status !== "ready") return [];
        return [{
          slug: related.slug,
          href: `/connect/${related.canonicalFromQid}/${related.canonicalToQid}`,
          headline:
            relatedValidation.snapshot.headline ??
            `${relatedValidation.snapshot.source.label} and ${relatedValidation.snapshot.target.label}`,
          description:
            relatedValidation.snapshot.introduction ??
            relatedValidation.snapshot.editorialExplanation,
          category: related.category,
          verifiedAt: related.verifiedAt,
          sourceName: relatedValidation.snapshot.source.label,
          targetName: relatedValidation.snapshot.target.label,
        }];
      }),
    },
  };
}

export function resolveEditorialConnectionPageData(
  rawFromQid: string,
  rawToQid: string,
  now = new Date(),
): ConnectionPageData | null {
  const fromQid = rawFromQid.trim().toUpperCase();
  const toQid = rawToQid.trim().toUpperCase();
  const connection = findEditorialConnection(fromQid, toQid);
  return connection ? resolveEditorialSnapshotPageData(connection, now) : null;
}
