import type {
  DiscoveryResult,
  SelectedEntity,
} from "../components/connection-types.ts";
import {
  findEditorialConnection,
  snapshotToDiscoveryResult,
  validateEditorialSnapshot,
  type EditorialConnection,
} from "./editorial-connections.ts";

export type EditorialPageDetails = {
  slug: string;
  verifiedAt: string;
  pathFingerprint: string;
  explanation: string;
  indexEligible: boolean;
  reviewStatus: "approved" | "needs-review" | "rejected";
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
  const validation = validateEditorialSnapshot(connection, now);
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
      verifiedAt: connection.verifiedAt,
      pathFingerprint: connection.pathFingerprint,
      explanation: validation.snapshot.editorialExplanation,
      indexEligible: connection.indexEligible,
      reviewStatus: connection.reviewStatus,
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
