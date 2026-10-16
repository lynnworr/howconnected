import assert from "node:assert/strict";
import test from "node:test";
import {
  createConnectionRecommendationCatalog,
  selectDailyRecommendations,
  selectResultRecommendations,
} from "../lib/connection-recommendations.ts";
import { getApprovedExploreConnections } from "../lib/explore-connections.ts";

const REVIEW_TIME = new Date("2026-10-16T12:00:00.000Z");
const approved = getApprovedExploreConnections(REVIEW_TIME);
const catalog = createConnectionRecommendationCatalog(approved);

test("recommendation catalog keeps only bounded reviewed-card fields", () => {
  assert.equal(catalog.length, approved.length);
  assert.deepEqual(Object.keys(catalog[0]).sort(), [
    "category",
    "description",
    "headline",
    "href",
    "slug",
    "sourceName",
    "sourceQid",
    "steps",
    "targetName",
    "targetQid",
  ]);
  assert.ok(catalog.every(({ href }) => /^\/connect\/Q[1-9]\d*\/Q[1-9]\d*$/.test(href)));
});

test("result recommendations prefer shared endpoints and exclude the current pair in either direction", () => {
  const shared = selectResultRecommendations(catalog, "Q1", "Q312");
  assert.equal(shared[0]?.slug, "steve-jobs-apple");
  assert.equal(shared[0]?.reason, "shared_endpoint");

  assert.deepEqual(
    selectResultRecommendations(catalog, "Q19837", "Q312").map(({ slug }) => slug),
    [],
  );
  assert.deepEqual(
    selectResultRecommendations(catalog, "Q312", "Q19837").map(({ slug }) => slug),
    [],
  );
});

test("manual editorial relationships remain available without duplicate cards", () => {
  const recommendations = selectResultRecommendations(
    catalog,
    "Q23548",
    "Q9916",
    {
      preferredSlugs: [
        "apollo-11-neil-armstrong",
        "france-paris",
        "apollo-11-neil-armstrong",
      ],
    },
  );

  assert.deepEqual(
    recommendations.map(({ slug }) => slug),
    ["apollo-11-neil-armstrong", "france-paris"],
  );
  assert.ok(recommendations.every(({ reason }) => reason === "editorial_related"));
  assert.equal(new Set(recommendations.map(({ slug }) => slug)).size, recommendations.length);
});

test("daily recommendations use only revealed path overlap and approved catalog entries", () => {
  const recommendations = selectDailyRecommendations(catalog, ["Q1", "Q312", "Q19837"]);
  assert.equal(recommendations[0]?.slug, "steve-jobs-apple");
  assert.equal(recommendations[0]?.reason, "daily_relevant");
  assert.ok(
    recommendations.every(({ slug }) => catalog.some((connection) => connection.slug === slug)),
  );
});

test("selection respects limits and prefers category diversity inside a relevance tier", () => {
  const synthetic = [
    { ...catalog[0], slug: "first-business", sourceQid: "Q1", category: "Business & technology" },
    { ...catalog[1], slug: "second-entertainment", sourceQid: "Q1", category: "Entertainment & media" },
    { ...catalog[2], slug: "third-business", sourceQid: "Q1", category: "Business & technology" },
  ];
  const recommendations = selectResultRecommendations(synthetic, "Q1", "Q2", { limit: 2 });
  assert.deepEqual(
    recommendations.map(({ slug }) => slug),
    ["first-business", "second-entertainment"],
  );
});
