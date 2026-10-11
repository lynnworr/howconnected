import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getApprovedExploreConnections,
  getFeaturedExploreConnection,
} from "../lib/explore-connections.ts";
import { EDITORIAL_CONNECTIONS } from "../lib/editorial-connections.ts";

const REVIEW_TIME = new Date("2026-10-10T12:00:00.000Z");

test("Explore derives exactly the approved, indexable, snapshot-ready collection", () => {
  const connections = getApprovedExploreConnections(REVIEW_TIME);
  assert.equal(connections.length, 3);
  assert.deepEqual(
    connections.map(({ slug }) => slug),
    [
      "steve-jobs-apple",
      "walt-disney-the-walt-disney-company",
      "nasa-dwight-eisenhower",
    ],
  );
  assert.equal(
    getFeaturedExploreConnection(connections)?.slug,
    "nasa-dwight-eisenhower",
  );
  assert.ok(
    connections.every(
      ({ slug }) =>
        EDITORIAL_CONNECTIONS.find((item) => item.slug === slug)?.reviewStatus ===
          "approved" &&
        EDITORIAL_CONNECTIONS.find((item) => item.slug === slug)?.indexEligible,
    ),
  );
});

test("Explore links, metadata, and structured data are server-rendered and crawlable", async () => {
  const [page, header, footer, home, seo] = await Promise.all([
    readFile(new URL("../app/explore/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PublicHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PublicFooter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/seo.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /alternates: \{ canonical: "\/explore" \}/);
  assert.match(page, /"@type": "CollectionPage"/);
  assert.match(page, /"@type": "ItemList"/);
  assert.match(page, /<h1/);
  assert.equal((page.match(/<h1/g) ?? []).length, 1);
  assert.match(page, /getApprovedExploreConnections\(\)/);
  assert.doesNotMatch(page, /discoverConnection|fetchWikidata|getNeo4jDriver/);
  for (const source of [header, footer, home, seo]) {
    assert.match(source, /\/explore/);
  }
});

test("Explore never includes review-gated editorial entries", () => {
  const visibleSlugs = new Set(
    getApprovedExploreConnections(REVIEW_TIME).map(({ slug }) => slug),
  );
  const gated = EDITORIAL_CONNECTIONS.filter(
    ({ reviewStatus, indexEligible }) =>
      reviewStatus !== "approved" || !indexEligible,
  );

  assert.ok(gated.length > 0);
  assert.ok(gated.every(({ slug }) => !visibleSlugs.has(slug)));
});
