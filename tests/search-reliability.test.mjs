import assert from "node:assert/strict";
import test from "node:test";
import { handleSearchRequest } from "../lib/search-api.ts";
import {
  createLatestRequestGuard,
  withOptionalSearchEnrichment,
} from "../lib/search-pipeline.ts";

const rawResults = [
  {
    id: "Q3454165",
    label: "Kevin Bacon",
    description: "American actor",
    url: "https://www.wikidata.org/entity/Q3454165",
  },
];

test("returns raw Wikidata results when optional enrichment gets a 429", async () => {
  const results = await withOptionalSearchEnrichment(
    async () => rawResults,
    async () => {
      throw new Error("Wikimedia returned HTTP 429");
    },
  );

  assert.deepEqual(results, rawResults);
});

test("returns raw Wikidata results when optional enrichment times out", async () => {
  const results = await withOptionalSearchEnrichment(
    async () => rawResults,
    async () => {
      throw new DOMException("Timed out", "TimeoutError");
    },
  );

  assert.deepEqual(results, rawResults);
});

test("propagates a primary Wikidata failure", async () => {
  await assert.rejects(
    withOptionalSearchEnrichment(async () => {
      throw new Error("Primary Wikidata lookup failed");
    }),
    /Primary Wikidata lookup failed/,
  );
});

test("search API preserves its friendly error when the primary lookup fails", async () => {
  const response = await handleSearchRequest(
    new Request("http://example.test/api/search?q=Kevin%20Bacon"),
    async () => {
      throw new Error("Primary unavailable");
    },
    () => {},
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "Wikidata search is currently unavailable.",
  });
});

test("queries shorter than two characters do not call the primary lookup", async () => {
  let called = false;
  const response = await handleSearchRequest(
    new Request("http://example.test/api/search?q=k"),
    async () => {
      called = true;
      return rawResults;
    },
  );

  assert.equal(response.status, 200);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), { results: [] });
});

test("a Kevin Bacon typing sequence only accepts the newest response", () => {
  const guard = createLatestRequestGuard();
  const queries = [
    "ke",
    "kev",
    "kevi",
    "kevin",
    "kevin b",
    "kevin ba",
    "kevin bacon",
  ];
  const requests = queries.map((query) => ({ query, id: guard.begin() }));
  const rendered = [];

  for (const request of [...requests].reverse()) {
    if (guard.isCurrent(request.id)) rendered.push(request.query);
  }

  assert.deepEqual(rendered, ["kevin bacon"]);
});
