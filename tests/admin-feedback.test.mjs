import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAdminFeedbackFilter,
  parseAdminFeedbackReason,
  summarizeFeedbackGroups,
} from "../lib/admin-feedback-core.ts";

test("feedback summary calculates totals and positive percentage", () => {
  const result = summarizeFeedbackGroups([
    { rating: "yes", reason: null, count: 7 },
    { rating: "not_really", reason: "too_generic", count: 2 },
    { rating: "not_really", reason: "incorrect", count: 1 },
  ]);

  assert.deepEqual(result.summary, {
    total: 10,
    positive: 7,
    negative: 3,
    positivePercentage: 70,
  });
});

test("negative reasons aggregate and sort by highest count", () => {
  const { negativeReasons } = summarizeFeedbackGroups([
    { rating: "not_really", reason: "incorrect", count: 2 },
    { rating: "not_really", reason: "too_generic", count: 4 },
    { rating: "not_really", reason: "incorrect", count: 3 },
    { rating: "yes", reason: "better_path_exists", count: 20 },
    { rating: "not_really", reason: "untrusted_reason", count: 50 },
  ]);

  assert.deepEqual(negativeReasons.slice(0, 2), [
    { reason: "incorrect", label: "Incorrect", count: 5 },
    { reason: "too_generic", label: "Too generic", count: 4 },
  ]);
  assert.equal(
    negativeReasons.find(({ reason }) => reason === "better_path_exists")?.count,
    0,
  );
});

test("admin feedback filters accept only controlled values", () => {
  assert.equal(parseAdminFeedbackFilter("positive"), "positive");
  assert.equal(parseAdminFeedbackFilter("unknown"), "all");
  assert.equal(parseAdminFeedbackReason("relationship_feels_weak"), "relationship_feels_weak");
  assert.equal(parseAdminFeedbackReason("anything"), null);
});
