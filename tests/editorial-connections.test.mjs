import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildConnectionRouteMetadata } from "../lib/connection-seo.ts";
import {
  createEditorialPathFingerprint,
  EDITORIAL_CONNECTIONS,
  getIndexableEditorialConnections,
  getRelatedEditorialConnections,
  validateEditorialSnapshot,
} from "../lib/editorial-connections.ts";
import { getEditorialSocialPreview } from "../lib/editorial-social-preview.ts";
import {
  resolveEditorialConnectionPageData,
  resolveEditorialSnapshotPageData,
} from "../lib/connection-page-state.ts";
import {
  allowNeo4jDiagnosticRoute,
  DIAGNOSTIC_NOINDEX_HEADERS,
} from "../lib/diagnostic-route-policy.ts";
import { isMalformedConnectionPath } from "../lib/connection-route-policy.ts";

const REVIEW_TIME = new Date("2026-10-17T16:00:00.000Z");

test("approved editorial snapshots are valid and fingerprints are stable", () => {
  for (const connection of EDITORIAL_CONNECTIONS) {
    assert.ok(connection.snapshot);
    assert.equal(
      createEditorialPathFingerprint(connection.snapshot),
      connection.pathFingerprint,
    );
    assert.equal(validateEditorialSnapshot(connection, REVIEW_TIME).status, "ready");
  }

  const indexable = getIndexableEditorialConnections(REVIEW_TIME);
  assert.equal(indexable.length, 12);
  assert.ok(
    indexable.every(
      ({ reviewStatus, indexEligible }) =>
        reviewStatus === "approved" && indexEligible,
    ),
  );
  assert.ok(indexable.every(({ canonicalFromQid }) => canonicalFromQid !== "Q9202"));
});

test("only an approved canonical orientation is indexable", () => {
  const approved = buildConnectionRouteMetadata("Q19837", "Q312", REVIEW_TIME);
  assert.deepEqual(approved.robots, { index: true, follow: true });
  assert.equal(
    approved.alternates?.canonical,
    "https://www.howconnected.app/connect/Q19837/Q312",
  );
  assert.equal(approved.twitter?.card, "summary_large_image");
  assert.deepEqual(approved.twitter?.images, [
    "https://www.howconnected.app/editorial-preview/Q19837/Q312",
  ]);

  const reversed = buildConnectionRouteMetadata("Q312", "Q19837", REVIEW_TIME);
  assert.deepEqual(reversed.robots, { index: false, follow: true });
  assert.equal(
    reversed.alternates?.canonical,
    "https://www.howconnected.app/connect/Q19837/Q312",
  );
  assert.equal(reversed.openGraph?.images, undefined);
  assert.equal(reversed.twitter?.images, undefined);

  const arbitrary = buildConnectionRouteMetadata("Q1", "Q2", REVIEW_TIME);
  assert.deepEqual(arbitrary.robots, { index: false, follow: true });
  assert.equal(arbitrary.title, "Explore a connection | HowConnected");
  assert.equal(arbitrary.openGraph?.images, undefined);
  assert.equal(arbitrary.twitter?.images, undefined);

  const jimKelly = buildConnectionRouteMetadata("Q127819", "Q221626", REVIEW_TIME);
  assert.deepEqual(jimKelly.robots, { index: true, follow: true });
  assert.equal(
    jimKelly.alternates?.canonical,
    "https://www.howconnected.app/connect/Q127819/Q221626",
  );
  const jimKellyReversed = buildConnectionRouteMetadata("Q221626", "Q127819", REVIEW_TIME);
  assert.deepEqual(jimKellyReversed.robots, { index: false, follow: true });
  assert.equal(
    jimKellyReversed.alternates?.canonical,
    "https://www.howconnected.app/connect/Q127819/Q221626",
  );
});

test("approved pages carry rich reviewed content and only approved related links", () => {
  const approved = getIndexableEditorialConnections(REVIEW_TIME);
  const approvedSlugs = new Set(approved.map(({ slug }) => slug));

  for (const connection of approved) {
    assert.ok(connection.snapshot.headline?.trim());
    assert.ok(connection.snapshot.introduction?.trim());
    assert.ok(connection.snapshot.relationshipMeaning?.trim());
    assert.ok(connection.snapshot.context?.length);
    assert.ok(connection.snapshot.verificationSources?.length);
    assert.ok(
      connection.snapshot.verificationSources.every(({ url }) =>
        url.startsWith("https://"),
      ),
    );
    assert.ok(
      getRelatedEditorialConnections(connection, REVIEW_TIME).every(({ slug }) =>
        approvedSlugs.has(slug),
      ),
    );
  }
});

test("social previews exist only for approved canonical snapshots", () => {
  const preview = getEditorialSocialPreview("Q43653", "Q1615", REVIEW_TIME);
  assert.equal(preview?.sourceName, "Apollo 11");
  assert.equal(preview?.relationship, "crew member");
  assert.match(preview?.qualifierSummary ?? "", /spacecraft commander/);
  assert.equal(getEditorialSocialPreview("Q1615", "Q43653", REVIEW_TIME), null);
  assert.equal(getEditorialSocialPreview("Q9202", "Q142", REVIEW_TIME), null);
  assert.equal(getEditorialSocialPreview("Q1", "Q2", REVIEW_TIME), null);
});

test("snapshot validation rejects missing, changed, and stale snapshots", () => {
  const original = EDITORIAL_CONNECTIONS[0];
  const missing = { ...original, snapshot: null };
  assert.equal(validateEditorialSnapshot(missing, REVIEW_TIME).status, "missing");
  assert.deepEqual(resolveEditorialSnapshotPageData(missing, REVIEW_TIME), {
    status: "editorial-unavailable",
    reason: "missing",
  });

  const changed = {
    ...original,
    snapshot: {
      ...original.snapshot,
      path: {
        ...original.snapshot.path,
        relationships: original.snapshot.path.relationships.map((relationship) => ({
          ...relationship,
          label: "unreviewed replacement",
          propertyId: "P127",
        })),
      },
    },
  };
  assert.equal(validateEditorialSnapshot(changed, REVIEW_TIME).status, "invalid");

  assert.equal(
    validateEditorialSnapshot(original, new Date("2028-01-01T00:00:00.000Z"))
      .status,
    "stale",
  );
  assert.deepEqual(
    resolveEditorialSnapshotPageData(
      original,
      new Date("2028-01-01T00:00:00.000Z"),
    ),
    { status: "editorial-unavailable", reason: "stale" },
  );
});

test("canonical editorial pages resolve from snapshots without live discovery", () => {
  const data = resolveEditorialConnectionPageData("Q19837", "Q312", REVIEW_TIME);
  assert.equal(data?.status, "success");
  assert.equal(data?.editorial?.pathFingerprint, "hc-v1-553e20db");
  assert.equal(data?.result.bestPath?.relationships[0].propertyId, "P112");

  assert.equal(
    resolveEditorialConnectionPageData("Q312", "Q19837", REVIEW_TIME),
    null,
    "reversed exploration remains on the live, direction-sensitive path",
  );
});

test("editorial resolution short-circuits request-time discovery and malformed routes 404", async () => {
  const [dataSource, pageSource] = await Promise.all([
    readFile(new URL("../lib/connection-page-data.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/connect/[fromQid]/[toQid]/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const editorialCheck = dataSource.indexOf("const editorialData");
  const editorialReturn = dataSource.indexOf(
    "if (editorialData) return editorialData",
    editorialCheck,
  );
  const discovery = dataSource.indexOf("await discoverConnection", editorialReturn);
  assert.ok(editorialCheck > -1 && editorialCheck < editorialReturn);
  assert.ok(editorialReturn < discovery);
  assert.match(pageSource, /if \(!isValidQid\(fromQid\) \|\| !isValidQid\(toQid\)\) notFound\(\)/);
});

test("editorial pages expose server-side entity and relationship evidence", async () => {
  const approved = getIndexableEditorialConnections(REVIEW_TIME);
  for (const connection of approved) {
    const path = connection.snapshot.path;
    assert.ok(
      path.nodes.every((node) => node.wikidataUrl?.startsWith("https://www.wikidata.org/wiki/Q")),
    );
    assert.ok(
      path.relationships.every((relationship) =>
        relationship.propertyUrl?.startsWith("https://www.wikidata.org/wiki/Property:P"),
      ),
    );
  }

  const resultSource = await readFile(
    new URL("../components/ConnectionResult.tsx", import.meta.url),
    "utf8",
  );
  const pathSource = await readFile(
    new URL("../components/ConnectionPath.tsx", import.meta.url),
    "utf8",
  );
  assert.match(resultSource, /result=\{data\.result\}|enrichDiscoveryResult/);
  assert.match(pathSource, /href=\{node\.wikidataUrl\}/);
});

test("editorial social images use snapshots without discovery or ingestion", async () => {
  const [imageSource, previewSource] = await Promise.all([
    readFile(
      new URL("../app/editorial-preview/[fromQid]/[toQid]/route.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/editorial-social-preview.ts", import.meta.url), "utf8"),
  ]);
  assert.match(imageSource, /ImageResponse/);
  assert.match(imageSource, /1200/);
  assert.match(previewSource, /validateEditorialSnapshot/);
  assert.doesNotMatch(`${imageSource}\n${previewSource}`, /discoverConnection|getNeo4jDriver|ingest/);
});

test("historical relationships retain qualifiers and stay unindexed pending review", () => {
  const statue = EDITORIAL_CONNECTIONS.find(
    ({ canonicalFromQid, canonicalToQid }) =>
      canonicalFromQid === "Q9202" && canonicalToQid === "Q142",
  );
  assert.ok(statue?.snapshot);
  assert.equal(statue.indexEligible, false);
  assert.equal(statue.reviewStatus, "needs-review");
  assert.deepEqual(
    statue.snapshot.path.relationships[0].qualifiers?.map(({ propertyId }) => propertyId),
    ["P582"],
  );
  assert.match(statue.snapshot.editorialExplanation, /until June 1885/);
  assert.match(statue.snapshot.editorialExplanation, /not.*current location/i);
  assert.deepEqual(
    buildConnectionRouteMetadata("Q9202", "Q142", REVIEW_TIME).robots,
    { index: false, follow: true },
  );
});

test("production blocks the Neo4j diagnostic route and all variants are noindex", () => {
  assert.equal(allowNeo4jDiagnosticRoute("production"), false);
  assert.equal(allowNeo4jDiagnosticRoute("development"), true);
  assert.deepEqual(DIAGNOSTIC_NOINDEX_HEADERS, {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
});

test("connection route policy rejects malformed IDs before streaming", () => {
  assert.equal(isMalformedConnectionPath("/connect/Q19837/Q312"), false);
  assert.equal(isMalformedConnectionPath("/connect/q19837/q312"), false);
  assert.equal(isMalformedConnectionPath("/connect/not-a-qid/Q312"), true);
  assert.equal(isMalformedConnectionPath("/connect/Q19837"), true);
  assert.equal(isMalformedConnectionPath("/connect/Q19837/Q312/extra"), true);
  assert.equal(isMalformedConnectionPath("/about"), false);
});
