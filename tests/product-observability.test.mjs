import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getConnectionOrigin, getDailyOrigin, isExtensionAttribution } from "../lib/connection-attribution.ts";

test("extension attribution accepts only the fixed non-identifying source value", () => {
  assert.equal(getConnectionOrigin("extension"), "extension");
  assert.equal(getConnectionOrigin("connection_share"), "connection_share");
  assert.equal(getConnectionOrigin("trending_homepage"), "trending_homepage");
  assert.equal(getConnectionOrigin(["extension", "ignored"]), "extension");
  assert.equal(getConnectionOrigin("newsletter"), "shared_url");
  assert.equal(getConnectionOrigin(undefined), "shared_url");
  assert.equal(isExtensionAttribution("extension"), true);
  assert.equal(isExtensionAttribution(["extension", "ignored"]), true);
  assert.equal(isExtensionAttribution("newsletter"), false);
  assert.equal(getDailyOrigin("daily_share"), "daily_share");
  assert.equal(getDailyOrigin("connection_share"), undefined);
  assert.equal(getDailyOrigin("newsletter"), undefined);
});

test("daily extension attribution is bounded and uses the existing duplicate-safe open event", async () => {
  const [page, challenge] = await Promise.all([
    readFile(new URL("../app/daily/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /getDailyOrigin\(query\.source\)/);
  assert.match(page, /origin=\{origin\}/);
  assert.match(challenge, /claimDailyAnalyticsEvent\(window\.sessionStorage, "opened"/);
  assert.match(challenge, /daily_challenge_opened/);
  assert.match(challenge, /claimDailyAnalyticsEvent\(window\.sessionStorage, "extension-referral"/);
  assert.match(challenge, /extension_referral_opened/);
  assert.match(challenge, /destination: "daily"/);
  assert.match(challenge, /origin/);
  assert.doesNotMatch(challenge, /pageTitle|rawTitle|activeTabUrl/);
});

test("public beta analytics covers outcomes and engagement without raw queries", async () => {
  const [analytics, schema, explorer, result, share, surprise, feedback, explore, recommendations, attribution] = await Promise.all([
    readFile(new URL("../lib/product-analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-analytics-schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ShareControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SurpriseMe.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/explore/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionRecommendations.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/connection-attribution.ts", import.meta.url), "utf8"),
  ]);

  for (const event of [
    "search_initiated",
    "search_succeeded",
    "search_no_reliable_path",
    "search_timed_out",
    "result_shared",
    "surprise_me_used",
    "additional_search_started",
    "explore_connection_opened",
    "related_connection_opened",
    "recommended_connection_impression",
    "recommended_connection_opened",
    "extension_referral_opened",
  ]) {
    assert.match(schema, new RegExp(`"${event}"`));
  }
  assert.match(explorer, /search_initiated/);
  assert.match(explorer, /search_no_reliable_path/);
  assert.match(explorer, /search_timed_out/);
  assert.match(result, /search_succeeded/);
  assert.match(share, /result_shared/);
  assert.match(surprise, /surprise_me_used/);
  assert.match(surprise, /surprise_me_shuffled/);
  assert.match(explorer, /hasViewedResultRef\.current/);
  assert.match(explorer, /hasViewedResultInSession/);
  assert.match(result, /markSessionResultViewed/);
  assert.match(explore, /explore_connection_opened/);
  assert.match(recommendations, /related_connection_opened/);
  assert.match(recommendations, /recommended_connection_impression/);
  assert.match(recommendations, /recommended_connection_opened/);
  assert.match(attribution, /value === EXTENSION_ATTRIBUTION_VALUE/);
  assert.doesNotMatch(attribution, /document\.referrer|localStorage|cookie/);
  assert.match(feedback, /path_feedback_submitted/);
  assert.doesNotMatch(analytics, /queryText|email|message/);
  assert.doesNotMatch(schema, /answerText|pageTitle|fullUrl|email|ipAddress|userId/);
});

test("share success is tracked only after the share provider accepts or copies", async () => {
  const share = await readFile(
    new URL("../components/ShareControls.tsx", import.meta.url),
    "utf8",
  );
  const copyPosition = share.indexOf("await copyText");
  const copyTrackPosition = share.indexOf('trackProductEvent("result_shared"', copyPosition);
  assert.ok(copyTrackPosition > copyPosition);
  assert.match(share, /outcome === "shared" \|\| outcome === "copied"/);
});
