import assert from "node:assert/strict";
import test from "node:test";
import {
  getConnectionPath,
  getConnectionSentence,
  getConnectionShareText,
  shareConnection,
} from "../lib/connection-share.ts";

test("preserves requested source and target order in connection URLs", () => {
  assert.equal(getConnectionPath("Q19837", "Q8704"), "/connect/Q19837/Q8704");
  assert.equal(getConnectionPath("Q8704", "Q19837"), "/connect/Q8704/Q19837");
});

test("formats singular and plural connection sentences", () => {
  assert.equal(
    getConnectionSentence("A", "B", 1),
    "A is connected to B in 1 step.",
  );
  assert.equal(
    getConnectionSentence("Steve Jobs", "Walt Disney", 3),
    "Steve Jobs is connected to Walt Disney in 3 steps.",
  );
});

test("places the connection URL after the share sentence", () => {
  assert.equal(
    getConnectionShareText(
      "Steve Jobs",
      "Walt Disney",
      3,
      "https://example.com/connect/Q19837/Q8704",
    ),
    "Steve Jobs is connected to Walt Disney in 3 steps.\n\nhttps://example.com/connect/Q19837/Q8704",
  );
});

test("uses native sharing with the generated sentence and URL", async () => {
  const shared = [];
  const copied = [];
  const outcome = await shareConnection(
    "Steve Jobs",
    "Walt Disney",
    3,
    "https://example.com/connect/Q19837/Q8704",
    {
      share: async (payload) => shared.push(payload),
      writeText: async (text) => copied.push(text),
    },
  );

  assert.equal(outcome, "shared");
  assert.deepEqual(shared, [
    {
      title: "HowConnected",
      text: "Steve Jobs is connected to Walt Disney in 3 steps.",
      url: "https://example.com/connect/Q19837/Q8704",
    },
  ]);
  assert.equal(copied.length, 0);
});

test("falls back to clipboard with the full share text", async () => {
  const copied = [];
  const outcome = await shareConnection(
    "Steve Jobs",
    "Walt Disney",
    3,
    "https://example.com/connect/Q19837/Q8704",
    { writeText: async (text) => copied.push(text) },
  );

  assert.equal(outcome, "copied");
  assert.deepEqual(copied, [
    "Steve Jobs is connected to Walt Disney in 3 steps.\n\nhttps://example.com/connect/Q19837/Q8704",
  ]);
});

test("falls back to clipboard when native sharing fails", async () => {
  const copied = [];
  const outcome = await shareConnection(
    "Steve Jobs",
    "Walt Disney",
    3,
    "https://example.com/connect/Q19837/Q8704",
    {
      share: async () => {
        throw new Error("Native share failed");
      },
      writeText: async (text) => copied.push(text),
    },
  );

  assert.equal(outcome, "copied");
  assert.equal(copied.length, 1);
});

test("fails gracefully when sharing and clipboard are unavailable", async () => {
  const outcome = await shareConnection(
    "Steve Jobs",
    "Walt Disney",
    3,
    "https://example.com/connect/Q19837/Q8704",
    {},
  );

  assert.equal(outcome, "unavailable");
});
