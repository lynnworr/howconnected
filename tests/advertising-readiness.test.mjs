import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canRenderAdvertising,
  getAdvertisingActivationIssues,
  isValidAdSensePublisherId,
} from "../lib/advertising-readiness.ts";

const ready = {
  enabled: true,
  environment: "production",
  consent: "granted",
  publisherId: `ca-pub-${"1".repeat(16)}`,
};

test("advertising requires explicit production configuration, consent, and a real-format publisher ID", () => {
  assert.equal(canRenderAdvertising(undefined), false);
  assert.equal(canRenderAdvertising({ ...ready, enabled: false }), false);
  assert.equal(canRenderAdvertising({ ...ready, environment: "preview" }), false);
  assert.equal(canRenderAdvertising({ ...ready, consent: "unknown" }), false);
  assert.equal(canRenderAdvertising({ ...ready, publisherId: "ca-pub-placeholder" }), false);
  assert.equal(canRenderAdvertising(ready), true);
  assert.equal(isValidAdSensePublisherId(`ca-pub-${"1".repeat(16)}`), true);
  assert.equal(isValidAdSensePublisherId(`pub-${"1".repeat(16)}`), false);
  assert.equal(getAdvertisingActivationIssues(undefined).length, 1);
});

test("inactive placements never load ad scripts and stay away from daily gameplay", async () => {
  const [slot, result, explore, methodology, daily, layout] = await Promise.all([
    readFile(new URL("../components/FutureAdPlacement.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/explore/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/methodology/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(result, /after-editorial-connection/);
  assert.match(explore, /explore-between-sections/);
  assert.match(methodology, /long-form-after-content/);
  assert.doesNotMatch(daily, /FutureAdPlacement|adsbygoogle|googlesyndication/);
  assert.doesNotMatch(`${slot}\n${layout}`, /adsbygoogle|googlesyndication|doubleclick/);
  assert.doesNotMatch(`${result}\n${explore}\n${methodology}`, /activation=/);
});

test("the owner-provided verification identifier is metadata-only and ads remain inactive", async () => {
  const [layout, privacy] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /"google-adsense-account": "ca-pub-1188060943119206"/);
  assert.equal((layout.match(/ca-pub-1188060943119206/g) ?? []).length, 1);
  assert.doesNotMatch(layout, /adsbygoogle|googlesyndication|doubleclick/);
  assert.match(privacy, /does not currently display Google AdSense ads/);
  assert.match(privacy, /cookies, web beacons, IP addresses/);
});
