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
});

test("product analytics rejects missing, malformed, sensitive, and unbounded properties", () => {
  assert.equal(sanitizeProductEvent("search_initiated", { fromQid: "Q1", toQid: "Q2", origin: "homepage" }), null);
  assert.equal(sanitizeProductEvent("search_initiated", { fromQid: "Q1", toQid: "Q2", origin: "homepage", sessionConnectionNumber: 1, queryText: "private" }), null);
  assert.equal(sanitizeProductEvent("search_succeeded", { fromQid: "Q1", toQid: "Q2", steps: 2, alternatePathCount: 0, origin: "campaign" }), null);
  assert.equal(sanitizeProductEvent("daily_challenge_completed", { puzzleId: "puzzle", category: "Unknown category", isCorrect: true }), null);
  assert.equal(sanitizeProductEvent("daily_challenge_opened", { puzzleId: "puzzle", category: "Music", utcDate: "2026-02-31" }), null);
  assert.equal(sanitizeProductEvent("extension_referral_opened", { destination: "daily", fromQid: "Q1", toQid: "Q2" }), null);
  assert.equal(sanitizeProductEvent("result_shared", { fromQid: "Q1", toQid: "Q2", steps: 2, method: "canceled", url: "https://example.com" }), null);
});

test("every product event has a unique allowlist without sensitive property names", () => {
  assert.equal(PRODUCT_EVENT_NAMES.length, new Set(PRODUCT_EVENT_NAMES).size);
  for (const name of PRODUCT_EVENT_NAMES) {
    const keys = getProductEventKeys(name);
    assert.equal(keys.length, new Set(keys).size, `${name} contains duplicate keys`);
    assert.ok(keys.every((key) => !/(queryText|answerText|pageTitle|fullUrl|email|ipAddress|userId)/i.test(key)), `${name} exposes a sensitive key`);
  }
});
