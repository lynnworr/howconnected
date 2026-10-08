import assert from "node:assert/strict";
import test from "node:test";
import {
  findWikipediaBridgeCandidates,
  normalizeWikipediaPageCandidates,
  resetWikipediaBridgeStateForTests,
  WIKIPEDIA_BRIDGE_LIMITS,
} from "../lib/wikipedia-bridges.ts";

test.beforeEach(() => resetWikipediaBridgeStateForTests());

test("resolves article-link titles to QIDs and enforces the per-side cap", () => {
  const normalized = normalizeWikipediaPageCandidates(
    {
      query: {
        pages: Array.from({ length: 30 }, (_, index) => ({
          title: `Article ${index + 1}`,
          pageprops: { wikibase_item: `Q${index + 1}` },
        })),
      },
    },
    WIKIPEDIA_BRIDGE_LIMITS.perSide,
  );

  assert.equal(normalized.length, 20);
  assert.deepEqual(normalized[0], {
    qid: "Q1",
    title: "Article 1",
    shared: false,
  });
});

test("batches root sitelinks and marks bridge candidates shared by both sides", async () => {
  const requested = [];
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.hostname === "www.wikidata.org") {
      return new Response(JSON.stringify({
        entities: [
          { id: "Q1", sitelinks: { enwiki: { title: "Source" } } },
          { id: "Q2", sitelinks: { enwiki: { title: "Target" } } },
        ],
      }));
    }
    const title = url.searchParams.get("titles");
    return new Response(JSON.stringify({
      query: {
        pages: title === "Source"
          ? [{ title: "Shared", pageprops: { wikibase_item: "Q99" } }]
          : [{ title: "Shared", pageprops: { wikibase_item: "Q99" } }],
      },
    }));
  };

  const result = await findWikipediaBridgeCandidates("Q1", "Q2", {
    fetchImpl,
    perSideCap: 5,
  });

  assert.equal(requested.filter((url) => url.hostname === "www.wikidata.org").length, 2);
  assert.equal(requested.filter((url) => url.hostname === "en.wikipedia.org").length, 2);
  assert.equal(result.source[0].qid, "Q99");
  assert.equal(result.source[0].shared, true);
  assert.equal(result.target[0].shared, true);
});

test("accepts the keyed wbgetentities response used by Wikidata", async () => {
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "www.wikidata.org" && url.searchParams.get("props") === "sitelinks") {
      return new Response(JSON.stringify({
        entities: {
          Q1: { id: "Q1", sitelinks: { enwiki: { title: "Source" } } },
          Q2: { id: "Q2", sitelinks: { enwiki: { title: "Target" } } },
        },
      }));
    }
    if (url.hostname === "en.wikipedia.org") {
      return new Response(JSON.stringify({
        query: { pages: [{ title: "Bridge", pageprops: { wikibase_item: "Q50" } }] },
      }));
    }
    return new Response(JSON.stringify({ entities: {} }));
  };

  const result = await findWikipediaBridgeCandidates("Q1", "Q2", { fetchImpl });
  assert.equal(result.status, "ok");
  assert.equal(result.source[0].qid, "Q50");
});

test("Wikipedia failure makes optional Stage C candidates unavailable", async () => {
  const result = await findWikipediaBridgeCandidates("Q1", "Q2", {
    fetchImpl: async () => new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": "60" },
    }),
    now: () => 1_000,
  });

  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.source, []);
  assert.deepEqual(result.target, []);
});
