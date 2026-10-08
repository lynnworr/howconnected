import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichConnectionPath,
  parseEntityEnrichmentResponse,
} from "../lib/connection-images.ts";
import {
  buildEnglishWikipediaUrl,
  resolveEntitySource,
} from "../lib/entity-source-utils.ts";

test("resolves Steve Jobs, Walt Disney, and Pixar to English Wikipedia", () => {
  for (const [qid, title, expectedSlug] of [
    ["Q19837", "Steve Jobs", "Steve_Jobs"],
    ["Q8704", "Walt Disney", "Walt_Disney"],
    ["Q127552", "Pixar", "Pixar"],
  ]) {
    const source = resolveEntitySource(qid, { enwiki: { title } });
    assert.equal(
      source?.wikipediaUrl,
      `https://en.wikipedia.org/wiki/${expectedSlug}`,
    );
    assert.equal(source?.sourceLabel, "Wikipedia");
  }
});

test("falls back to Wikidata when no English Wikipedia sitelink exists", () => {
  assert.deepEqual(resolveEntitySource("Q123456789", {}), {
    wikipediaUrl: null,
    wikidataUrl: "https://www.wikidata.org/wiki/Q123456789",
    sourceLabel: "Wikidata",
  });
});

test("malformed or missing QIDs do not produce source links", () => {
  assert.equal(resolveEntitySource("not-a-qid", { enwiki: { title: "Example" } }), null);
  assert.equal(resolveEntitySource(null, { enwiki: { title: "Example" } }), null);
});

test("Wikipedia titles are safely URL encoded", () => {
  assert.equal(
    buildEnglishWikipediaUrl("A/B?x#y"),
    "https://en.wikipedia.org/wiki/A%2FB%3Fx%23y",
  );
  assert.equal(buildEnglishWikipediaUrl("   "), null);
});

test("parses safe source URLs and enriches a path", () => {
  const parsed = parseEntityEnrichmentResponse({
    images: { Q19837: null },
    sources: {
      Q19837: {
        wikipediaUrl: "https://en.wikipedia.org/wiki/Steve_Jobs",
        wikidataUrl: "https://www.wikidata.org/wiki/Q19837",
        sourceLabel: "Wikipedia",
      },
    },
  });
  assert.ok(parsed);

  const path = enrichConnectionPath(
    {
      steps: 1,
      nodes: [
        { name: "Steve Jobs", type: "person", qid: "Q19837" },
        { name: "Unknown", type: "entity", qid: null },
      ],
      relationships: [{ label: "connected to", from: "Steve Jobs", to: "Unknown" }],
    },
    parsed.images,
    parsed.sources,
  );

  assert.equal(path.nodes[0].wikipediaUrl, "https://en.wikipedia.org/wiki/Steve_Jobs");
  assert.equal(path.nodes[0].wikidataUrl, "https://www.wikidata.org/wiki/Q19837");
  assert.equal(path.nodes[1].wikipediaUrl, undefined);
  assert.equal(path.nodes[1].wikidataUrl, undefined);
});

test("rejects source URLs from untrusted hosts", () => {
  assert.equal(
    parseEntityEnrichmentResponse({
      images: { Q1: null },
      sources: {
        Q1: {
          wikipediaUrl: "https://example.com/wiki/Not_Wikipedia",
          wikidataUrl: "https://www.wikidata.org/wiki/Q1",
          sourceLabel: "Wikipedia",
        },
      },
    }),
    null,
  );
});
