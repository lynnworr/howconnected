import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public beta analytics covers outcomes and engagement without raw queries", async () => {
  const [analytics, explorer, result, share, surprise, feedback] = await Promise.all([
    readFile(new URL("../lib/product-analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ShareControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SurpriseMe.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
  ]);

  for (const event of [
    "search_initiated",
    "search_succeeded",
    "search_no_reliable_path",
    "search_timed_out",
    "result_shared",
    "surprise_me_used",
  ]) {
    assert.match(analytics, new RegExp(`"${event}"`));
  }
  assert.match(explorer, /search_initiated/);
  assert.match(explorer, /search_no_reliable_path/);
  assert.match(explorer, /search_timed_out/);
  assert.match(result, /search_succeeded/);
  assert.match(share, /result_shared/);
  assert.match(surprise, /surprise_me_used/);
  assert.match(feedback, /path_feedback_submitted/);
  assert.doesNotMatch(analytics, /queryText|email|message/);
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
