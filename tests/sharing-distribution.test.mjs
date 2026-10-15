import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildAttributedShareUrl,
  CONNECTION_SHARE_ATTRIBUTION,
  DAILY_SHARE_ATTRIBUTION,
  getDailyShareCopy,
  isShareAttribution,
} from "../lib/share-attribution.ts";
import { sanitizeProductEvent } from "../lib/product-analytics-schema.ts";

test("share links use only fixed, non-identifying attribution values", () => {
  assert.equal(
    buildAttributedShareUrl("/daily?date=2026-10-15#answer", DAILY_SHARE_ATTRIBUTION, "https://www.howconnected.app"),
    "https://www.howconnected.app/daily?source=daily_share",
  );
  assert.equal(
    buildAttributedShareUrl("/connect/Q937/Q935", CONNECTION_SHARE_ATTRIBUTION, "https://www.howconnected.app"),
    "https://www.howconnected.app/connect/Q937/Q935?source=connection_share",
  );
  assert.equal(isShareAttribution("daily_share"), true);
  assert.equal(isShareAttribution("connection_share"), true);
  assert.equal(isShareAttribution("person-123"), false);
  assert.throws(
    () => buildAttributedShareUrl("https://example.com/collect", DAILY_SHARE_ATTRIBUTION, "https://www.howconnected.app"),
    /stay on HowConnected/,
  );
});

test("daily share copy is compelling, complete, and spoiler-free", () => {
  const url = "https://www.howconnected.app/daily?source=daily_share";
  const content = getDailyShareCopy({ puzzleNumber: 42, dateKey: "2026-11-25", url });
  assert.equal(content.title, "The Missing Link");
  assert.match(content.text, /Challenge #42/);
  assert.match(content.text, /Completed/);
  assert.match(content.text, /Can you find today's hidden connection\?/);
  assert.match(content.clipboardText, /Play: https:\/\/www\.howconnected\.app\/daily\?source=daily_share/);
  for (const secret of ["correctOptionId", "pathFingerprint", "explanation", "isCorrect", "selectedOptionId"]) {
    assert.doesNotMatch(`${content.text}\n${content.clipboardText}`, new RegExp(secret));
  }
});

test("share referrals flow through the existing privacy-conscious origin field", () => {
  assert.deepEqual(sanitizeProductEvent("daily_challenge_opened", {
    puzzleId: "toy-story-hanks-apollo-13",
    category: "Entertainment and film",
    utcDate: "2026-10-15",
    origin: "daily_share",
  }), {
    puzzleId: "toy-story-hanks-apollo-13",
    category: "Entertainment and film",
    utcDate: "2026-10-15",
    origin: "daily_share",
  });
  assert.deepEqual(sanitizeProductEvent("search_succeeded", {
    fromQid: "Q937",
    toQid: "Q935",
    steps: 2,
    alternatePathCount: 0,
    origin: "connection_share",
  }), {
    fromQid: "Q937",
    toQid: "Q935",
    steps: 2,
    alternatePathCount: 0,
    origin: "connection_share",
  });
});

test("distribution CTAs and social preview remain contextual and crawlable", async () => {
  const [daily, result, extension, shareControls, image] = await Promise.all([
    readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/extension/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ShareControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily/opengraph-image.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(daily, /come back after 00:00 UTC/);
  assert.match(daily, /role="status" aria-live="polite"/);
  assert.match(result, /href="\/daily"/);
  assert.match(result, /destination: "daily"/);
  assert.match(extension, /href="\/daily"/);
  assert.match(shareControls, /CONNECTION_SHARE_ATTRIBUTION/);
  assert.match(image, /Two endpoints\. One hidden connection\./);
  assert.doesNotMatch(image, /correctOptionId|pathFingerprint|explanation/);
});
