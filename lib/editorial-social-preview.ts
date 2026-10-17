import {
  findEditorialConnection,
  getEditorialPublicationDecision,
  validateEditorialSnapshot,
} from "./editorial-connections.ts";

export type EditorialSocialPreview = {
  headline: string;
  sourceName: string;
  targetName: string;
  relationship: string;
  qualifierSummary: string | null;
  verifiedAt: string;
};

export function getEditorialSocialPreview(
  rawFromQid: string,
  rawToQid: string,
  now = new Date(),
): EditorialSocialPreview | null {
  const connection = findEditorialConnection(
    rawFromQid.trim().toUpperCase(),
    rawToQid.trim().toUpperCase(),
  );
  if (!connection || getEditorialPublicationDecision(connection, { now }).status !== "public") {
    return null;
  }

  const validation = validateEditorialSnapshot(connection, now);
  if (validation.status !== "ready") return null;
  const relationship = validation.snapshot.path.relationships[0];

  return {
    headline:
      validation.snapshot.headline ??
      `${validation.snapshot.source.label} and ${validation.snapshot.target.label}`,
    sourceName: validation.snapshot.source.label,
    targetName: validation.snapshot.target.label,
    relationship: relationship?.label ?? "connected to",
    qualifierSummary:
      relationship?.qualifiers?.map(({ label, value }) => `${label}: ${value}`).join(" · ") ||
      null,
    verifiedAt: connection.verifiedAt,
  };
}
