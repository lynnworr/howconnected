import assert from "node:assert/strict";
import test from "node:test";
import { REAL_WORLD_RELIABILITY_PAIRS } from "../scripts/real-world-reliability-pairs.mjs";
import {
  classifyAttempt,
  compareAttempts,
  summarizeReliability,
} from "../scripts/real-world-reliability-lib.mjs";

test("real-world reliability corpus is fixed, balanced, and separate", () => {
  assert.equal(REAL_WORLD_RELIABILITY_PAIRS.length, 48);
  assert.equal(new Set(REAL_WORLD_RELIABILITY_PAIRS.map(({ id }) => id)).size, 48);
  const categories = Object.groupBy(
    REAL_WORLD_RELIABILITY_PAIRS,
    ({ category }) => category,
  );
  assert.deepEqual(Object.keys(categories).sort(), [
    "business", "entertainment", "geography", "history", "music", "science",
    "sports", "technology",
  ]);
  assert.ok(Object.values(categories).every((pairs) => pairs.length === 6));
  assert.ok(REAL_WORLD_RELIABILITY_PAIRS.some(({ expectation }) => expectation === "direct"));
  assert.ok(REAL_WORLD_RELIABILITY_PAIRS.some(({ expectation }) => expectation === "multi-step"));
  assert.ok(REAL_WORLD_RELIABILITY_PAIRS.some(({ expectation }) => expectation === "difficult"));
  assert.ok(REAL_WORLD_RELIABILITY_PAIRS.some(({ expectation }) => expectation === "no-strong-path"));
  assert.ok(REAL_WORLD_RELIABILITY_PAIRS.every(({ sourceQid, targetQid }) => /^Q[1-9]\d*$/.test(sourceQid) && /^Q[1-9]\d*$/.test(targetQid)));
});

test("classifies target-aware recovery without weakening semantic quality", () => {
  const pair = REAL_WORLD_RELIABILITY_PAIRS[0];
  const attempt = classifyAttempt(pair, {
    found: true,
    httpStatus: 200,
    pathDetails: {
      steps: 1,
      score: 1.45,
      qualityBand: "strong",
      nodes: [{ name: "Albert Einstein" }, { name: "Isaac Newton" }],
      relationships: [{ storedType: "INFLUENCED_BY", direction: "forward" }],
    },
    pathNames: ["Albert Einstein", "Isaac Newton"],
    pathQids: ["Q937", "Q935"],
    pathLength: 1,
    qualityBand: "strong",
    score: 1.45,
    stage: "B",
    runtimeMs: 2500,
    timedOut: false,
    diagnostics: {
      expandedBySide: {
        source: [{ depth: 0, alreadyExpanded: true, relationshipsAdded: 1 }],
        target: [],
      },
    },
  });

  assert.equal(attempt.meaningful, true);
  assert.equal(attempt.discoveryMode, "cold");
  assert.equal(attempt.recoveryKind, "target-aware-fanout");
});

test("treats a forward geographic hierarchy as meaningful but flags a shared-container return", () => {
  const pair = REAL_WORLD_RELIABILITY_PAIRS.find(({ id }) => id === "geography-eiffel-paris");
  const response = {
    found: true,
    httpStatus: 200,
    pathNames: ["Eiffel Tower", "Champ de Mars", "7th arrondissement of Paris", "Paris"],
    pathQids: ["Q243", "Q217925", "Q259463", "Q90"],
    pathLength: 3,
    qualityBand: "strong",
    score: 4.45,
    stage: "B",
    runtimeMs: 8000,
    timedOut: false,
    diagnostics: { expandedBySide: { source: [], target: [] } },
  };
  const hierarchy = classifyAttempt(pair, {
    ...response,
    pathDetails: {
      steps: 3,
      score: 4.45,
      qualityBand: "strong",
      nodes: response.pathNames.map((name) => ({ name })),
      relationships: [
        { storedType: "LOCATION", direction: "forward" },
        { storedType: "LOCATED_IN_ADMINISTRATIVE_ENTITY", direction: "forward" },
        { storedType: "LOCATED_IN_ADMINISTRATIVE_ENTITY", direction: "forward" },
      ],
    },
  });
  const sharedContainer = classifyAttempt(pair, {
    ...response,
    pathLength: 2,
    pathDetails: {
      steps: 2,
      score: 3.95,
      qualityBand: "strong",
      nodes: [{ name: "Eiffel Tower" }, { name: "France" }, { name: "Paris" }],
      relationships: [
        { storedType: "COUNTRY", direction: "forward" },
        { storedType: "COUNTRY", direction: "reverse" },
      ],
    },
  });

  assert.equal(hierarchy.meaningful, true);
  assert.deepEqual(hierarchy.suspiciousPatterns, []);
  assert.equal(sharedContainer.meaningful, false);
  assert.ok(sharedContainer.suspiciousPatterns.includes("generic-geographic-container"));
});

test("separates technical failures, legitimate no-paths, and retry recovery", () => {
  const difficult = REAL_WORLD_RELIABILITY_PAIRS.find(({ expectation }) => expectation === "difficult");
  const noPath = REAL_WORLD_RELIABILITY_PAIRS.find(({ expectation }) => expectation === "no-strong-path");
  const timeout = classifyAttempt(difficult, {
    found: false, httpStatus: 200, pathDetails: null, pathNames: [], pathQids: [],
    pathLength: null, qualityBand: null, stage: null, runtimeMs: 25000,
    timedOut: true, failureCategory: "timeout_or_budget", diagnostics: null,
  });
  const legitimate = classifyAttempt(noPath, {
    found: false, httpStatus: 200, pathDetails: null, pathNames: [], pathQids: [],
    pathLength: null, qualityBand: null, stage: null, runtimeMs: 1000,
    timedOut: false, failureCategory: "no_strong_path", diagnostics: null,
  });
  const recovered = { ...timeout, found: true, meaningful: true, discoveryOutcome: "meaningful_path", pathQids: ["Q1", "Q2"] };
  const comparison = compareAttempts(timeout, recovered);
  const summary = summarizeReliability([
    { first: timeout, retry: recovered, comparison },
    { first: legitimate, retry: legitimate, comparison: compareAttempts(legitimate, legitimate) },
  ]);

  assert.equal(timeout.technicalFailure, true);
  assert.equal(legitimate.legitimateNoPath, true);
  assert.equal(comparison.retryRecovered, true);
  assert.equal(summary.technicalFailureRate, 0.5);
  assert.equal(summary.legitimateNoPathRate, 0.5);
});
