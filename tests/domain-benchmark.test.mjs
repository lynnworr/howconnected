import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySemanticQuality,
  detectSuspiciousPatterns,
  diagnoseFailure,
  rankDomains,
  resultsToCsv,
  summarizeResults,
} from "../scripts/domain-benchmark-lib.mjs";
import { DOMAIN_BENCHMARK_PAIRS } from "../scripts/domain-benchmark-pairs.mjs";

test("domain benchmark contains seven pairs for each requested domain", () => {
  const counts = Object.groupBy(DOMAIN_BENCHMARK_PAIRS, ({ domain }) => domain);
  assert.equal(DOMAIN_BENCHMARK_PAIRS.length, 98);
  assert.equal(Object.keys(counts).length, 14);
  assert.ok(Object.values(counts).every((pairs) => pairs.length === 7));
  assert.equal(
    new Set(
      DOMAIN_BENCHMARK_PAIRS.map(
        ({ domain, sourceQid, targetQid }) =>
          `${domain}:${sourceQid}:${targetQid}`,
      ),
    ).size,
    DOMAIN_BENCHMARK_PAIRS.length,
  );
});

test("flags investment firms and repeated membership as suspicious", () => {
  const patterns = detectSuspiciousPatterns({
    nodes: [
      { name: "NASA", type: "company/organization" },
      { name: "BlackRock", type: "company/organization" },
      { name: "Coca-Cola", type: "company/organization" },
    ],
    relationships: [
      { storedType: "MEMBER_OF", direction: "forward" },
      { storedType: "MEMBER_OF", direction: "reverse" },
    ],
  });
  assert.ok(patterns.includes("investment-firm-bridge"));
  assert.ok(patterns.includes("repeated-membership"));
});

test("flags a geographic container used to select an unrelated citizen", () => {
  const patterns = detectSuspiciousPatterns({
    nodes: [
      { name: "NASA", type: "company/organization" },
      { name: "Washington, D.C.", type: "place" },
      { name: "United States", type: "place" },
      { name: "John Pemberton", type: "person" },
    ],
    relationships: [
      { storedType: "HEADQUARTERS_LOCATION", direction: "forward" },
      { storedType: "COUNTRY", direction: "forward" },
      { storedType: "COUNTRY_OF_CITIZENSHIP", direction: "reverse" },
    ],
  });
  assert.ok(patterns.includes("country-unrelated-citizen"));
});

test("marks suspicious found paths bad independently of engine quality", () => {
  assert.equal(
    classifySemanticQuality({
      found: true,
      path: { steps: 4, score: 6 },
      suspiciousPatterns: ["investment-firm-bridge"],
    }),
    "bad",
  );
  assert.equal(
    classifySemanticQuality({
      found: true,
      path: { steps: 5, score: 7 },
      suspiciousPatterns: [],
    }),
    "borderline",
  );
});

test("summarizes rates and ranks stronger domains first", () => {
  const results = [
    { domain: "strong", found: true, qualityBand: "strong", semanticQuality: "good", suspicious: false, timedOut: false, runtimeMs: 100 },
    { domain: "weak", found: false, qualityBand: null, semanticQuality: "bad", suspicious: false, timedOut: true, runtimeMs: 300 },
  ];
  assert.equal(summarizeResults(results).averageRuntimeMs, 200);
  assert.equal(summarizeResults(results).medianRuntimeMs, 200);
  assert.equal(rankDomains(results)[0].domain, "strong");
});

test("diagnoses rejected and timed-out failures", () => {
  assert.deepEqual(
    diagnoseFailure({ found: false, timedOut: true }),
    ["discovery depth/budget issue"],
  );
  assert.deepEqual(
    diagnoseFailure({
      found: false,
      timedOut: false,
      bestRejectedPath: { patternPenalty: 4, score: 7 },
    }),
    ["path-quality penalty rejection"],
  );
  assert.deepEqual(
    diagnoseFailure({
      found: false,
      httpStatus: 502,
      terminationReason: "Could not fetch a Wikidata entity.",
    }),
    ["upstream Wikidata failure"],
  );
  assert.deepEqual(
    diagnoseFailure({
      found: false,
      timedOut: true,
      sourceType: "entity",
      targetType: "place",
      depthReached: 3,
      expandedEntities: 4,
    }),
    [
      "discovery depth/budget issue",
      "missing entity-domain classification",
      "missing Wikidata property family",
      "missing bridge relationship",
    ],
  );
});

test("CSV output safely escapes path and diagnostic fields", () => {
  const csv = resultsToCsv([{
    domain: "books, literature",
    sourceLabel: "A",
    sourceQid: "Q1",
    targetLabel: "B",
    targetQid: "Q2",
    found: true,
    path: ["A", "B"],
    qualityBand: "strong",
    semanticQuality: "good",
    suspicious: false,
    suspiciousPatterns: [],
    stage: "A",
    runtimeMs: 10,
    terminationReason: "already-connected",
    failureCategories: [],
  }]);
  assert.match(csv, /"books, literature"/);
  assert.match(csv, /A -> B/);
});
