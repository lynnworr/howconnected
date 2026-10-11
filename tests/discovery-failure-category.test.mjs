import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDiscoveryFailure,
  isDiscoveryFailureCategory,
} from "../lib/discovery-failure-category.ts";

test("exposes only bounded privacy-safe discovery failure categories", () => {
  assert.equal(classifyDiscoveryFailure({ found: true }), "none");
  assert.equal(classifyDiscoveryFailure({ timedOut: true }), "timeout_or_budget");
  assert.equal(classifyDiscoveryFailure({ terminationReason: "hard-deadline-exceeded" }), "timeout_or_budget");
  assert.equal(classifyDiscoveryFailure({ terminationReason: "Wikidata request failed" }), "upstream_wikidata");
  assert.equal(classifyDiscoveryFailure({ bestRejectedPath: { score: 9 } }), "semantic_quality_rejection");
  assert.equal(classifyDiscoveryFailure({ terminationReason: "no-acceptable-semantic-path" }), "no_strong_path");
  assert.equal(isDiscoveryFailureCategory("neo4j_unavailable"), true);
  assert.equal(isDiscoveryFailureCategory("https://example.com/private-url"), false);
});
