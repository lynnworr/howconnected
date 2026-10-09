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
import {
  buildExternalCandidates,
  buildExternalReportSections,
  compareExternalReports,
  diagnoseExternalFailure,
  isRetryableExternalResult,
  selectBalancedExternalCorpus,
  selectExternalDevelopmentCorpus,
} from "../scripts/external-gap-scan-lib.mjs";

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

  assert.match(source, /Internal Gap Scan/);
  assert.match(source, /getLatestCoverageGapSummary/);
  assert.match(source, /False-negative rate/);
  assert.match(source, /External Wikidata Coverage Scan/);
  assert.match(source, /getLatestExternalCoverageGapSummary/);
});

test("external candidates come only from explicit Wikidata bindings and balance by property", () => {
  const config = { id: "P123", label: "publisher", family: "software/games", supportStatus: "unsupported", sourceDomains: ["product"], targetDomains: ["company/organization"], relevance: 5, complexity: "low", hubRisk: "low", likelyCodeArea: "registry" };
  const bindings = [{
    source: { value: "http://www.wikidata.org/entity/Q1" },
    target: { value: "http://www.wikidata.org/entity/Q2" },
    sourceLabel: { value: "Work" },
    targetLabel: { value: "Publisher" },
    sourceSitelinks: { value: "20" },
    targetSitelinks: { value: "10" },
  }];
  const p123 = buildExternalCandidates(config, bindings);
  const p400 = buildExternalCandidates({ ...config, id: "P400", label: "platform" }, [{ ...bindings[0], source: { value: "http://www.wikidata.org/entity/Q3" }, target: { value: "http://www.wikidata.org/entity/Q4" } }]);
  const selected = selectBalancedExternalCorpus([...p123, ...p400], 2);

  assert.equal(p123.length, 1);
  assert.equal(p123[0].wikidataProperty, "P123");
  assert.deepEqual(new Set(selected.map(({ wikidataProperty }) => wikidataProperty)), new Set(["P123", "P400"]));
  assert.deepEqual(
    selectExternalDevelopmentCorpus([...p123, ...p400], 2).map(({ wikidataProperty }) => wikidataProperty),
    ["P123", "P400"],
  );
});

test("external diagnostics distinguish unsupported, selection, ingestion, and engine failures", () => {
  const pair = {
    wikidataProperty: "P123",
    supportStatus: "unsupported",
    expectedSourceDomains: ["product"],
    expectedTargetDomains: ["company/organization"],
  };
  const result = { found: false, httpStatus: 200, diagnostics: { timedOut: true, terminationReason: "time-budget-exhausted", bestRejectedPath: { patternPenalty: 3 } } };
  const causes = diagnoseExternalFailure(pair, result, {
    enabledProperties: [], reverseEnabledProperties: [], sourceSelectedProperties: [], targetReverseSelectedProperties: [],
    sourcePresent: true, targetPresent: false, relationshipPresent: false, sourceDomain: "entity", targetDomain: "entity",
  });

  assert.ok(causes.includes("unsupported property"));
  assert.ok(causes.includes("source misclassification"));
  assert.ok(causes.includes("target misclassification"));
  assert.ok(causes.includes("ingestion missing"));
  assert.ok(causes.includes("timeout"));
  assert.ok(causes.includes("path exists but scoring rejected"));
  assert.ok(causes.includes("path-pattern penalty rejected"));
  assert.equal(isRetryableExternalResult({ found: false, httpStatus: 502, terminationReason: "Could not fetch a Wikidata entity." }), true);
  assert.equal(isRetryableExternalResult({ found: false, httpStatus: 200, runtimeMs: 60_001, terminationReason: "no-acceptable-semantic-path" }), true);
  assert.equal(isRetryableExternalResult({ found: false, httpStatus: 200, terminationReason: "no-acceptable-semantic-path" }), false);
});

test("external reports aggregate properties and families and compare repeatable pairs", () => {
  const config = { id: "P123", label: "publisher", family: "software/games", supportStatus: "unsupported", sourceDomains: ["product"], targetDomains: ["company/organization"], relevance: 5, complexity: "low", hubRisk: "low", likelyCodeArea: "registry" };
  const failed = { pairId: "p1", wikidataProperty: "P123", relationshipFamily: "software/games", sourceQid: "Q1", sourceName: "Work", sourceDomain: "product", targetQid: "Q2", targetName: "Publisher", targetDomain: "company/organization", found: false, falseNegative: true, runtimeMs: 100, failureCauses: ["unsupported property"], productionAttemptFrequency: 0 };
  const passed = { ...failed, pairId: "p2", found: true, falseNegative: false, failureCauses: [], runtimeMs: 50 };
  const sections = buildExternalReportSections([failed, passed], [config]);
  const comparison = compareExternalReports(
    { runId: "before", summary: { falseNegativeRate: 1 }, propertyCoverage: sections.propertyCoverage, results: [failed] },
    { runId: "after", summary: { falseNegativeRate: 0 }, propertyCoverage: [{ ...sections.propertyCoverage[0], falseNegativeRate: 0 }], results: [{ ...failed, found: true, falseNegative: false }] },
  );

  assert.equal(sections.propertyCoverage[0].tested, 2);
  assert.equal(sections.familyCoverage[0].falseNegativeRate, 0.5);
  assert.equal(sections.unsupportedProperties[0].property, "P123");
  assert.equal(sections.unsupportedProperties[0].sampleFailureRate, 0.5);
  assert.equal(sections.recommendations[0].expectedCoverageGain, 1);
  assert.deepEqual(comparison.falseNegativesFixed, ["p1"]);
  assert.equal(comparison.overallCoverageChange, 1);
});
