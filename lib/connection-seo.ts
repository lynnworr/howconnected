import type { Metadata } from "next";
import {
  findEditorialConnection,
  findReversedEditorialConnection,
  validateEditorialSnapshot,
  type EditorialConnection,
  type SnapshotValidation,
} from "./editorial-connections.ts";
import { getCanonicalConnectionUrl, SITE_ORIGIN } from "./seo.ts";
import { isValidQid } from "./wikidata-id.ts";

export type EditorialRouteMatch = {
  orientation: "canonical" | "reversed";
  connection: EditorialConnection;
  validation: SnapshotValidation;
};

export function getEditorialRouteMatch(
  rawFromQid: string,
  rawToQid: string,
  now = new Date(),
): EditorialRouteMatch | null {
  const fromQid = rawFromQid.trim().toUpperCase();
  const toQid = rawToQid.trim().toUpperCase();
  const canonical = findEditorialConnection(fromQid, toQid);
  if (canonical) {
    return {
      orientation: "canonical",
      connection: canonical,
      validation: validateEditorialSnapshot(canonical, now),
    };
  }

  const reversed = findReversedEditorialConnection(fromQid, toQid);
  return reversed
    ? {
        orientation: "reversed",
        connection: reversed,
        validation: validateEditorialSnapshot(reversed, now),
      }
    : null;
}

function noindexMetadata(input: {
  title: string;
  description: string;
  canonical?: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    ...(input.canonical
      ? { alternates: { canonical: input.canonical } }
      : {}),
    robots: { index: false, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      type: "website",
      siteName: "HowConnected",
      ...(input.canonical ? { url: input.canonical } : {}),
    },
    twitter: { card: "summary", title: input.title, description: input.description },
  };
}

export function buildConnectionRouteMetadata(
  rawFromQid: string,
  rawToQid: string,
  now = new Date(),
): Metadata {
  const fromQid = rawFromQid.trim().toUpperCase();
  const toQid = rawToQid.trim().toUpperCase();

  if (!isValidQid(fromQid) || !isValidQid(toQid)) {
    return noindexMetadata({
      title: "Invalid connection | HowConnected",
      description: "Choose two valid entities to explore a connection.",
    });
  }

  const routeMatch = getEditorialRouteMatch(fromQid, toQid, now);
  if (routeMatch) {
    const { connection, orientation, validation } = routeMatch;
    const snapshot = connection.snapshot;
    const sourceName =
      orientation === "canonical"
        ? snapshot?.source.label
        : snapshot?.target.label;
    const targetName =
      orientation === "canonical"
        ? snapshot?.target.label
        : snapshot?.source.label;
    const pairName =
      sourceName && targetName ? `${sourceName} and ${targetName}` : "this connection";
    const canonicalUrl = getCanonicalConnectionUrl(
      connection.canonicalFromQid,
      connection.canonicalToQid,
    );
    const canIndex =
      orientation === "canonical" &&
      connection.indexEligible &&
      connection.reviewStatus === "approved" &&
      validation.status === "ready";

    if (canIndex && validation.status === "ready") {
      const title = `${validation.snapshot.headline ?? `${validation.snapshot.source.label} and ${validation.snapshot.target.label}`} | HowConnected`;
      const description =
        validation.snapshot.introduction ?? validation.snapshot.editorialExplanation;
      const imageUrl = `${SITE_ORIGIN}/editorial-preview/${connection.canonicalFromQid}/${connection.canonicalToQid}`;
      return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        robots: { index: true, follow: true },
        openGraph: {
          title,
          description,
          type: "website",
          siteName: "HowConnected",
          url: canonicalUrl,
          images: [{ url: imageUrl, width: 1200, height: 630 }],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
      };
    }

    return noindexMetadata({
      title: `Explore ${pairName} | HowConnected`,
      description: `Explore a factual connection between ${pairName} on HowConnected.`,
      ...(orientation === "reversed" &&
      connection.indexEligible &&
      connection.reviewStatus === "approved" &&
      validation.status === "ready"
        ? { canonical: canonicalUrl }
        : {}),
    });
  }

  const currentUrl = getCanonicalConnectionUrl(fromQid, toQid);
  return noindexMetadata({
    title: "Explore a connection | HowConnected",
    description:
      "Explore a factual relationship path between two entities on HowConnected.",
    canonical: currentUrl,
  });
}
