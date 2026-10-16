import assert from "node:assert/strict";
import test from "node:test";
import { getProductEventKeys, PRODUCT_EVENT_NAMES, sanitizeProductEvent } from "../lib/product-analytics-schema.ts";

test("product analytics accepts the bounded production schemas", () => {
  assert.deepEqual(sanitizeProductEvent("search_initiated", {
    fromQid: "Q19837", toQid: "Q312", origin: "homepage", sessionConnectionNumber: 1,
  }), { fromQid: "Q19837", toQid: "Q312", origin: "homepage", sessionConnectionNumber: 1 });
  assert.deepEqual(sanitizeProductEvent("daily_challenge_completed", {
    puzzleId: "toy-story-hanks-apollo-13", category: "Entertainment and film", isCorrect: true, origin: "extension",
  }), { puzzleId: "toy-story-hanks-apollo-13", category: "Entertainment and film", isCorrect: true, origin: "extension" });
  assert.deepEqual(sanitizeProductEvent("extension_referral_opened", {
    destination: "connection", fromQid: "Q19837", toQid: "Q312",
  }), { destination: "connection", fromQid: "Q19837", toQid: "Q312" });
  assert.deepEqual(sanitizeProductEvent("extension_referral_opened", {
    destination: "daily", puzzleId: "toy-story-hanks-apollo-13", category: "Entertainment and film",
  }), { destination: "daily", puzzleId: "toy-story-hanks-apollo-13", category: "Entertainment and film" });
  assert.deepEqual(sanitizeProductEvent("publisher_landing_opened"), {});
  assert.deepEqual(sanitizeProductEvent("publisher_request_cta_clicked", {
    publisherPlacement: "hero",
  }), { publisherPlacement: "hero" });
  assert.deepEqual(sanitizeProductEvent("publisher_request_submitted", {
    requestScope: "one_widget", commercialInterest: "maybe_price",
  }), { requestScope: "one_widget", commercialInterest: "maybe_price" });
  assert.deepEqual(sanitizeProductEvent("publisher_request_submitted", {
    requestScope: "ongoing_use",
  }), { requestScope: "ongoing_use" });
  assert.deepEqual(sanitizeProductEvent("homepage_example_opened", {
    connection: "nasa-dwight-eisenhower", category: "History",
  }), { connection: "nasa-dwight-eisenhower", category: "History" });
  assert.deepEqual(sanitizeProductEvent("homepage_search_example_selected", {
    pairId: "france-paris", fromQid: "Q142", toQid: "Q90",
  }), { pairId: "france-paris", fromQid: "Q142", toQid: "Q90" });
  assert.deepEqual(sanitizeProductEvent("homepage_discovery_interacted", {
    action: "view_all_reviewed",
  }), { action: "view_all_reviewed" });
  assert.deepEqual(sanitizeProductEvent("navigation_link_clicked", {
    destination: "explore", navigationPlacement: "mobile_header",
  }), { destination: "explore", navigationPlacement: "mobile_header" });
  assert.deepEqual(sanitizeProductEvent("extension_install_clicked", {
    extensionPlacement: "extension_page_hero",
  }), { extensionPlacement: "extension_page_hero" });
  assert.deepEqual(sanitizeProductEvent("recommended_connection_impression", {
    connection: "steve-jobs-apple",
    recommendationSurface: "result",
    recommendationReason: "shared_endpoint",
  }), {
    connection: "steve-jobs-apple",
    recommendationSurface: "result",
    recommendationReason: "shared_endpoint",
  });
  assert.deepEqual(sanitizeProductEvent("recommended_connection_opened", {
    connection: "apollo-11-neil-armstrong",
    recommendationSurface: "daily",
    recommendationReason: "daily_relevant",
  }), {
    connection: "apollo-11-neil-armstrong",
    recommendationSurface: "daily",
    recommendationReason: "daily_relevant",
  });
  assert.deepEqual(sanitizeProductEvent("extension_install_clicked", {
    extensionPlacement: "connection_result",
  }), { extensionPlacement: "connection_result" });
});

test("product analytics rejects missing, malformed, sensitive, and unbounded properties", () => {
  assert.equal(sanitizeProductEvent("search_initiated", { fromQid: "Q1", toQid: "Q2", origin: "homepage" }), null);
  assert.equal(sanitizeProductEvent("search_initiated", { fromQid: "Q1", toQid: "Q2", origin: "homepage", sessionConnectionNumber: 1, queryText: "private" }), null);
  assert.equal(sanitizeProductEvent("search_succeeded", { fromQid: "Q1", toQid: "Q2", steps: 2, alternatePathCount: 0, origin: "campaign" }), null);
  assert.equal(sanitizeProductEvent("daily_challenge_completed", { puzzleId: "puzzle", category: "Unknown category", isCorrect: true }), null);
  assert.equal(sanitizeProductEvent("daily_challenge_opened", { puzzleId: "puzzle", category: "Music", utcDate: "2026-02-31" }), null);
  assert.equal(sanitizeProductEvent("extension_referral_opened", { destination: "daily", fromQid: "Q1", toQid: "Q2" }), null);
  assert.equal(sanitizeProductEvent("result_shared", { fromQid: "Q1", toQid: "Q2", steps: 2, method: "canceled", url: "https://example.com" }), null);
  assert.equal(sanitizeProductEvent("publisher_request_submitted", {
    requestScope: "one_widget", commercialInterest: "maybe_price", email: "private@example.com",
  }), null);
  assert.equal(sanitizeProductEvent("publisher_request_cta_clicked", { publisherPlacement: "email" }), null);
  assert.equal(sanitizeProductEvent("homepage_example_opened", { connection: "unknown", category: "Unknown" }), null);
  assert.equal(sanitizeProductEvent("homepage_search_example_selected", { pairId: "private pair", fromQid: "Q142", toQid: "Q90" }), null);
  assert.equal(sanitizeProductEvent("navigation_link_clicked", { destination: "explore", navigationPlacement: "footer" }), null);
  assert.equal(sanitizeProductEvent("extension_install_clicked", { extensionPlacement: "https://example.com" }), null);
  assert.equal(sanitizeProductEvent("recommended_connection_opened", {
    connection: "steve-jobs-apple", recommendationSurface: "homepage", recommendationReason: "shared_endpoint",
  }), null);
  assert.equal(sanitizeProductEvent("recommended_connection_impression", {
    connection: "Steve Jobs", recommendationSurface: "result", recommendationReason: "shared_endpoint",
  }), null);
});

test("every product event has a unique allowlist without sensitive property names", () => {
  assert.equal(PRODUCT_EVENT_NAMES.length, new Set(PRODUCT_EVENT_NAMES).size);
  for (const name of PRODUCT_EVENT_NAMES) {
    const keys = getProductEventKeys(name);
    assert.equal(keys.length, new Set(keys).size, `${name} contains duplicate keys`);
    assert.ok(keys.every((key) => !/(queryText|answerText|pageTitle|fullUrl|email|ipAddress|userId|publisherName|websiteUrl|requestedConnection|intendedUse|message)/i.test(key)), `${name} exposes a sensitive key`);
  }
});
