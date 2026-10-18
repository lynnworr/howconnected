import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getEmbeddableConnection, getEmbeddableConnections } from "../lib/embed-connections.ts";

const REVIEW_TIME = new Date("2026-10-15T12:00:00.000Z");

test("embeds expose only approved snapshot-backed editorial connections", () => {
  const embeds = getEmbeddableConnections(REVIEW_TIME);
  assert.equal(embeds.length, 12);
  assert.ok(embeds.every(({ connection, snapshot }) => connection.reviewStatus === "approved" && connection.indexEligible && snapshot.path.nodes.length > 1));
  assert.ok(
    embeds.some(({ connection }) => connection.slug === "jim-kelly-buffalo-bills"),
  );
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
  assert.match(page, /allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox/);
  assert.match(page, /no third-party cookies, fingerprinting, personal identifiers/);
  assert.match(page, /Turn your articles into interactive discoveries/);
  assert.match(page, /Install in three steps/);
  assert.match(page, /Request a custom widget/);
  assert.match(page, /publisher_request_cta_clicked/);
  assert.match(page, /PublisherLandingAnalytics/);
  assert.match(analytics, /widget_link_opened/);
  assert.match(attribution, /publisher_widget/);
  assert.doesNotMatch(page, /Stripe|subscription|premium plan/i);
});

test("publisher operations preserve a manual editorial approval boundary", async () => {
  const [requestPage, requestRoute, core, operations, tracker] = await Promise.all([
    readFile(new URL("../app/widgets/request/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/widget-requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/widget-request-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/phase-7f-publisher-pilot.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/publisher-pilot-tracker.template.csv", import.meta.url), "utf8"),
  ]);
  assert.match(requestPage, /every request is evaluated manually/i);
  assert.match(requestRoute, /deliverWidgetRequestWithResend/);
  assert.doesNotMatch(requestRoute + core, /editorial-connections|discoverConnection|getNeo4jDriver|ingest/i);
  assert.match(operations, /Manual editorial fulfillment workflow/);
  assert.match(operations, /Never expose a pending request through the embed allowlist/i);
  assert.match(tracker, /prospect_organization/);
  assert.match(tracker, /willingness_to_pay_indication/);
});
