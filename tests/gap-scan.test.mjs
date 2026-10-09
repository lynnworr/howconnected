import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clusterFailures,
  compareGapReports,
  diagnoseFailure,
  gapResultsToCsv,
  generateDirectCandidates,
  selectBalancedCorpus,
  summarizeGapResults,
} from "../scripts/gap-scan-lib.mjs";

const entity = (qid, name, type) => ({ qid, name, type, description: "", degree: 2, attempts: 0 });

test("generates expected pairs only from explicit configured relationships", () => {
  const edges = [{
    source: entity("Q1", "Example team", "sports team"),
    target: entity("Q2", "Example sport", "entity"),
    property: "P641",
    relationshipType: "SPORT",
  }];
  const families = [{
    id: "sport-team",
    label: "sport ↔ team",
    relevance: 5,
    complexity: "low",
    likelyFix: "Enable sport coverage.",
    relationships: [{ property: "P641", queryDirection: "reverse", sourceDomains: ["sports team"], targetDomains: [], sourcePattern: null, targetPattern: null, sourceExcludePattern: null, targetExcludePattern: null }],
  }];

  const pairs = generateDirectCandidates(edges, families);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].source.qid, "Q2");
  assert.equal(pairs[0].target.qid, "Q1");
  assert.deepEqual(pairs[0].expectedProperties, ["P641"]);
});

test("balances corpus selection and avoids duplicate directional pairs", () => {
  const candidates = [
    { id: "a1", relationshipFamily: "a", source: entity("Q1", "A", "entity"), target: entity("Q2", "B", "entity") },
    { id: "a2", relationshipFamily: "a", source: entity("Q3", "C", "entity"), target: entity("Q4", "D", "entity") },
    { id: "b1", relationshipFamily: "b", source: entity("Q5", "E", "entity"), target: entity("Q6", "F", "entity") },
    { id: "b2", relationshipFamily: "b", source: entity("Q7", "G", "entity"), target: entity("Q8", "H", "entity") },
  ];

  const selected = selectBalancedCorpus(candidates, [], 4);

  assert.equal(selected.length, 4);
  assert.deepEqual(new Set(selected.map(({ relationshipFamily }) => relationshipFamily)), new Set(["a", "b"]));
  assert.equal(new Set(selected.map(({ source, target }) => [source.qid, target.qid].sort().join(":"))).size, 4);
});

test("diagnoses failures from concrete configuration and engine evidence", () => {
  const pair = {
    queryDirection: "reverse",
    expectedProperties: ["P999"],
    source: { type: "entity" },
    target: { type: "sports team" },
  };
  const result = {
    found: false,
    httpStatus: 200,
    diagnostics: {
      timedOut: true,
      terminationReason: "time-budget-exhausted",
      bestRejectedPath: { patternPenalty: 4 },
    },
  };

  const causes = diagnoseFailure(pair, result, {
    enabledProperties: [],
    reverseEnabledProperties: [],
    selectedProperties: [],
    missingEntityQids: ["Q1"],
  });

  assert.ok(causes.includes("property not enabled"));
  assert.ok(causes.includes("reverse traversal not enabled"));
  assert.ok(causes.includes("timeout"));
  assert.ok(causes.includes("path exists in Neo4j but scoring rejected it"));
  assert.ok(causes.includes("path-pattern penalty rejected it"));
  assert.ok(causes.includes("entity missing from graph"));
});

test("clusters, prioritizes, summarizes, compares, and exports scan results", () => {
  const base = {
    pairId: "pair-1",
    relationshipFamily: "sport-team",
    relationshipFamilyLabel: "sport ↔ team",
    expectedProperties: ["P641"],
    sourceDomain: "entity",
    targetDomain: "sports team",
    sourceQid: "Q1",
    sourceName: "Sport",
    targetQid: "Q2",
    targetName: "Team",
    runtimeMs: 100,
    relevance: 5,
    complexity: "low",
    likelyFix: "Select P641.",
    productionAttemptFrequency: 3,
  };
  const failed = { ...base, found: false, falseNegative: true, failureCauses: ["property not selected for entity domain"] };
  const passed = { ...base, pairId: "pair-2", found: true, falseNegative: false, failureCauses: [], runtimeMs: 200 };
  const clusters = clusterFailures([failed, passed]);
  const summary = summarizeGapResults([failed, passed]);
  const comparison = compareGapReports(
    { runId: "before", results: [failed], clusters },
    { runId: "after", results: [{ ...failed, found: true, falseNegative: false }], clusters: [] },
  );

  assert.equal(clusters[0].tested, 2);
  assert.equal(clusters[0].failures, 1);
  assert.equal(clusters[0].falseNegativeRate, 0.5);
  assert.ok(clusters[0].priorityScore > 0);
  assert.equal(summary.falseNegativeRate, 0.5);
  assert.deepEqual(comparison.falseNegativesFixed, ["pair-1"]);
  assert.match(gapResultsToCsv([failed]), /sport-team/);
});

test("private admin source renders the latest coverage-gap summary", async () => {
  const source = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

  assert.match(source, /Coverage Gaps/);
  assert.match(source, /getLatestCoverageGapSummary/);
  assert.match(source, /False-negative rate/);
});
