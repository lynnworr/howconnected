import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePathFeedbackRequest,
  validatePathFeedback,
} from "../lib/path-feedback.ts";

const validFeedback = {
  fromQid: "Q19837",
  toQid: "Q8704",
  rating: "not_really",
  reason: "too_generic",
  pathSteps: 3,
};

test("validates and normalizes structured path feedback", () => {
  assert.deepEqual(
    validatePathFeedback({ ...validFeedback, fromQid: " q19837 " }),
    validFeedback,
  );
});

test("rejects invalid QIDs, ratings, reasons, steps, and extra fields", () => {
  assert.equal(validatePathFeedback({ ...validFeedback, fromQid: "Steve" }), null);
  assert.equal(validatePathFeedback({ ...validFeedback, rating: "maybe" }), null);
  assert.equal(validatePathFeedback({ ...validFeedback, reason: "other" }), null);
  assert.equal(validatePathFeedback({ ...validFeedback, pathSteps: 6 }), null);
  assert.equal(validatePathFeedback({ ...validFeedback, email: "no@example.com" }), null);
  assert.equal(
    validatePathFeedback({ ...validFeedback, rating: "yes", reason: "incorrect" }),
    null,
  );
});

test("feedback API handler stores valid feedback", async () => {
  let stored = null;
  const request = new Request("http://example.test/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validFeedback),
  });

  const response = await handlePathFeedbackRequest(request, async (feedback) => {
    stored = feedback;
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(stored, validFeedback);
});

test("feedback API handler returns 400 and does not store invalid input", async () => {
  let storeCalled = false;
  const request = new Request("http://example.test/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...validFeedback, reason: "free-form PII is rejected" }),
  });

  const response = await handlePathFeedbackRequest(request, async () => {
    storeCalled = true;
  });

  assert.equal(response.status, 400);
  assert.equal(storeCalled, false);
  assert.deepEqual(await response.json(), { error: "Feedback fields are invalid." });
});

test("feedback API handler rejects malformed JSON", async () => {
  const response = await handlePathFeedbackRequest(
    new Request("http://example.test/api/feedback", {
      method: "POST",
      body: "not-json",
    }),
    async () => {},
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Feedback must be valid JSON." });
});
