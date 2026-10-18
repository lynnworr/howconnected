import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getTrendingPublicationDecision,
  MINIMUM_TRENDING_CARDS,
  TRENDING_SIGNALS,
  selectTrendingConnections,
} from "../lib/trending-connections.ts";
import { getApprovedExploreConnections } from "../lib/explore-connections.ts";
import { MISSING_LINK_PUZZLES } from "../lib/daily-puzzles.ts";

const LAUNCH_DATE = "2026-10-15";

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
  const [source, component, homepageComponent, homepage] = await Promise.all([
    readFile(new URL("../lib/trending-connections.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/TrendingConnections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/HomepageTrendingConnections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /neo4j|getNeo4jDriver|discoverConnection|ingest/i);
  assert.doesNotMatch(component, /trendSourceUrl|sourceTitle|sourceUrl/);
  assert.doesNotMatch(homepageComponent, /neo4j|getNeo4jDriver|discoverConnection|ingest/i);
  assert.match(homepageComponent, /await connection\(\)/);
  assert.doesNotMatch(homepage, /trending:\s*getHomepageTrendingConnections\(\)/);
});

test("all public trend and analytics fields fail closed on future-answer disclosure", () => {
  const puzzle = MISSING_LINK_PUZZLES.find(({ schedulePosition }) => schedulePosition === 5);
  assert.ok(puzzle);
  const hidden = puzzle.path[puzzle.hiddenNodeIndex];
  const baseSignal = {
    ...TRENDING_SIGNALS[0],
    editorialSlug: "safe-reviewed",
    label: "Current documented signal",
    sourceTitle: "Current documented source",
    sourceUrl: "https://example.com/current-source",
  };
  const baseConnection = approved("safe-reviewed");
  const cases = [
    { signal: { ...baseSignal, label: hidden.name }, connection: baseConnection },
    { signal: { ...baseSignal, sourceTitle: hidden.name }, connection: baseConnection },
    { signal: { ...baseSignal, sourceUrl: `https://example.com/${hidden.name.replaceAll(" ", "-")}` }, connection: baseConnection },
    { signal: { ...baseSignal, sourceUrl: `https://example.com/${encodeURIComponent(hidden.name)}` }, connection: baseConnection },
    { signal: { ...baseSignal, editorialSlug: hidden.name }, connection: approved(hidden.name) },
    { signal: baseSignal, connection: { ...baseConnection, headline: hidden.name } },
    { signal: baseSignal, connection: { ...baseConnection, sourceQid: hidden.qid } },
  ];

  for (const { signal, connection } of cases) {
    const decision = getTrendingPublicationDecision(signal, [connection], {
      now: new Date("2026-10-17T16:00:00Z"),
      launchDate: LAUNCH_DATE,
    });
    assert.equal(decision.status, "held");
    assert.equal(decision.reason, "future-puzzle");
    assert.deepEqual(
      selectTrendingConnections(
        [signal],
        [connection],
        new Date("2026-10-17T16:00:00Z"),
        1,
        LAUNCH_DATE,
      ),
      [],
    );
  }
});

test("the existing Tesla-SpaceX trend remains eligible", () => {
  const now = new Date("2026-10-17T16:00:00Z");
  const approvedConnections = getApprovedExploreConnections(now);
  const decision = getTrendingPublicationDecision(
    TRENDING_SIGNALS[0],
    approvedConnections,
    { now, launchDate: LAUNCH_DATE },
  );
  assert.deepEqual(decision, { status: "public", conflicts: [] });
});

test("both reviewed trends activate together and expire without unpublishing editorials", () => {
  const now = new Date("2026-10-17T19:20:00Z");
  const approvedConnections = getApprovedExploreConnections(now);
  const active = selectTrendingConnections(
    TRENDING_SIGNALS,
    approvedConnections,
    now,
    MINIMUM_TRENDING_CARDS,
    LAUNCH_DATE,
  );
  assert.deepEqual(active.map(({ slug }) => slug), [
    "tesla-spacex",
    "jim-kelly-buffalo-bills",
  ]);
  assert.ok(
    TRENDING_SIGNALS.every(
      ({ expiresAt }) => expiresAt === "2026-10-25T00:00:00.000Z",
    ),
  );
  assert.deepEqual(
    selectTrendingConnections(
      TRENDING_SIGNALS,
      approvedConnections,
      new Date("2026-10-25T00:00:00Z"),
      MINIMUM_TRENDING_CARDS,
      LAUNCH_DATE,
    ),
    [],
  );
  assert.ok(
    getApprovedExploreConnections(new Date("2026-10-25T00:00:00Z"))
      .some(({ slug }) => slug === "jim-kelly-buffalo-bills"),
  );
});
