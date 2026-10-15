import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getEmbeddableConnection, getEmbeddableConnections } from "../lib/embed-connections.ts";

const REVIEW_TIME = new Date("2026-10-15T12:00:00.000Z");

test("embeds expose only approved snapshot-backed editorial connections", () => {
  const embeds = getEmbeddableConnections(REVIEW_TIME);
  assert.equal(embeds.length, 10);
  assert.ok(embeds.every(({ connection, snapshot }) => connection.reviewStatus === "approved" && connection.indexEligible && snapshot.path.nodes.length > 1));
  assert.equal(getEmbeddableConnection("george-lucas-lucasfilm", REVIEW_TIME), null);
  assert.equal(getEmbeddableConnection("../api/ingest", REVIEW_TIME), null);
  assert.equal(getEmbeddableConnection("unknown-connection", REVIEW_TIME), null);
});

test("embed route is static, noindex, canonical, and never invokes live discovery", async () => {
  const [page, widget, proxy] = await Promise.all([
    readFile(new URL("../app/embed/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionWidget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /if \(!data\) notFound\(\)/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.match(page, /getCanonicalConnectionUrl/);
  assert.doesNotMatch(page + widget, /discoverConnection|fetchWikidata|getNeo4jDriver|daily-puzzles/);
  assert.match(proxy, /frame-ancestors 'self' https:/);
  assert.match(proxy, /frame-ancestors 'none'/);
  assert.match(proxy, /X-Frame-Options/);
  assert.match(proxy, /getEmbeddableConnection/);
  assert.match(proxy, /status: 404/);
});

test("publisher page supplies a privacy-conscious responsive iframe", async () => {
  const [page, analytics, attribution] = await Promise.all([
    readFile(new URL("../app/widgets/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-analytics-schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connection-attribution.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /width="100%"/);
  assert.match(page, /height="560"/);
  assert.match(page, /allow-scripts allow-popups allow-popups-to-escape-sandbox/);
  assert.match(page, /no third-party cookies, fingerprinting, personal identifiers/);
  assert.match(analytics, /widget_link_opened/);
  assert.match(attribution, /publisher_widget/);
  assert.doesNotMatch(page, /Stripe|subscription|premium plan/i);
});
