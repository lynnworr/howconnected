import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MINIMUM_TRENDING_CARDS,
  TRENDING_SIGNALS,
  selectTrendingConnections,
} from "../lib/trending-connections.ts";

const approved = (slug) => ({
  slug,
  href: `/connect/Q1/Q2`,
  canonicalUrl: `https://www.howconnected.app/connect/Q1/Q2`,
  sourceQid: "Q1",
  targetQid: "Q2",
  sourceName: "One",
  targetName: "Two",
  headline: "One connects to Two.",
  category: "Business & technology",
  description: "Reviewed.",
  verifiedAt: "2026-10-17T00:00:00.000Z",
  steps: 1,
  path: [{ name: "One", relationship: "test" }, { name: "Two" }],
});

test("homepage trending stays hidden with fewer than two eligible cards", () => {
  const selected = selectTrendingConnections(
    TRENDING_SIGNALS,
    [approved("tesla-spacex")],
    new Date("2026-10-17T16:00:00Z"),
  );
  assert.equal(MINIMUM_TRENDING_CARDS, 2);
  assert.deepEqual(selected, []);
});

test("trending selection requires approved editorial data and expires automatically", () => {
  const signals = [
    TRENDING_SIGNALS[0],
    { ...TRENDING_SIGNALS[0], editorialSlug: "second-reviewed" },
  ];
  const active = selectTrendingConnections(
    signals,
    [approved("tesla-spacex"), approved("second-reviewed")],
    new Date("2026-10-17T16:00:00Z"),
  );
  assert.equal(active.length, 2);
  assert.ok(active.every(({ href }) => href.endsWith("?source=trending_homepage")));
  assert.deepEqual(
    selectTrendingConnections(signals, [approved("tesla-spacex")], new Date("2026-10-17T16:00:00Z")),
    [],
  );
  assert.deepEqual(
    selectTrendingConnections(signals, [approved("tesla-spacex"), approved("second-reviewed")], new Date("2026-10-25T00:00:00Z")),
    [],
  );
});

test("homepage trending has no Neo4j dependency", async () => {
  const source = await readFile(new URL("../lib/trending-connections.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /neo4j|getNeo4jDriver|discoverConnection|ingest/i);
});
