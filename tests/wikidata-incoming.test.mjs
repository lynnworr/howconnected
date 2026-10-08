import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchIncomingWikidataEntities,
  INCOMING_LOOKUP_LIMITS,
  normalizeIncomingSearchResults,
  resetIncomingLookupStateForTests,
  selectReverseDiscoveryProperties,
} from "../lib/wikidata-incoming.ts";
import { APPROVED_WIKIDATA_PROPERTIES } from "../lib/wikidata-properties.ts";

const castMember = APPROVED_WIKIDATA_PROPERTIES.P161;

test.beforeEach(() => resetIncomingLookupStateForTests());

test("normalizes and deduplicates only valid incoming QIDs", () => {
  assert.deepEqual(
    normalizeIncomingSearchResults({
      query: {
        search: [
          { title: "Q100" },
          { title: "Q100" },
          { title: "not-a-qid" },
          { title: 12 },
          { title: "Q200" },
        ],
      },
    }),
    ["Q100", "Q200"],
  );
});

test("uses bounded property-specific inverse lookup parameters", async () => {
  let requestedUrl = "";
  const result = await fetchIncomingWikidataEntities("Q3454165", castMember, {
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          query: {
            search: Array.from({ length: 12 }, (_, index) => ({
              title: `Q${index + 1}`,
            })),
          },
        }),
      );
    },
  });

  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get("srsearch"), "haswbstatement:P161=Q3454165");
  assert.equal(
    url.searchParams.get("srlimit"),
    String(castMember.reverseDiscoveryFanout),
  );
  assert.equal(result.qids.length, castMember.reverseDiscoveryFanout);
});

test("reuses cached inverse lookup results", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ query: { search: [{ title: "Q1" }] } }),
    );
  };

  const first = await fetchIncomingWikidataEntities("Q3454165", castMember, {
    fetchImpl,
  });
  const second = await fetchIncomingWikidataEntities("Q3454165", castMember, {
    fetchImpl,
  });

  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.qids, ["Q1"]);
  assert.equal(INCOMING_LOOKUP_LIMITS.cacheTtlMs, 6 * 60 * 60 * 1_000);
});

test("fails gracefully and respects cooldown after a 429", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": "120" },
    });
  };

  const first = await fetchIncomingWikidataEntities("Q3454165", castMember, {
    fetchImpl,
    now: () => 1_000,
  });
  const second = await fetchIncomingWikidataEntities("Q3454166", castMember, {
    fetchImpl,
    now: () => 2_000,
  });

  assert.equal(calls, 1);
  assert.equal(first.status, "unavailable");
  assert.equal(first.reason, "rate-limited");
  assert.equal(second.status, "unavailable");
  assert.equal(second.reason, "rate-limited");
});

test("selects only relevant reverse properties within the global property cap", () => {
  const selected = selectReverseDiscoveryProperties(
    {
      type: "person",
      description: "American actor, director, and writer",
    },
    Object.values(APPROVED_WIKIDATA_PROPERTIES),
  );

  assert.deepEqual(
    selected.map((property) => property.wikidataProperty),
    ["P161", "P725", "P57"],
  );
  assert.equal(selected.length, INCOMING_LOOKUP_LIMITS.maxPropertiesPerEntity);
});

test("configured reverse discovery labels describe traversal from target to source", () => {
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P161.reverseLabel, "appeared in");
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P725.reverseLabel, "voiced");
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P54.reverseLabel, "has player");
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P108.reverseLabel, "employs");
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P112.reverseLabel, "founded");
});

test("reorders reverse properties using entity context", () => {
  const writer = selectReverseDiscoveryProperties(
    { type: "person", description: "American writer and screenwriter" },
    Object.values(APPROVED_WIKIDATA_PROPERTIES),
  );
  const beverageCompany = selectReverseDiscoveryProperties(
    {
      type: "company/organization",
      description: "multinational beverage corporation",
    },
    Object.values(APPROVED_WIKIDATA_PROPERTIES),
  );

  assert.deepEqual(
    writer.slice(0, 2).map((property) => property.wikidataProperty),
    ["P58", "P50"],
  );
  assert.deepEqual(
    beverageCompany.map((property) => property.wikidataProperty),
    ["P176", "P108", "P859"],
  );
});
