import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MISSING_LINK_PUZZLES, getContentRunwayReport, getDailyScheduleState, getUtcDateKey, validateDailyPuzzleRegistry,
} from "../lib/daily-puzzles.ts";
import {
  claimDailyAnalyticsEvent, completeDailyChallenge, EMPTY_DAILY_COMPLETION_STATE, getDailyResult, getVisibleCurrentStreak, parseDailyCompletionState,
} from "../lib/daily-challenge-state.ts";

test("approved Missing Link registry validates exact paths, evidence, links, and distractors", () => {
  assert.deepEqual(validateDailyPuzzleRegistry(), []);
  assert.equal(MISSING_LINK_PUZZLES.length, 19);
  const puzzle = MISSING_LINK_PUZZLES[0];
  assert.equal(puzzle.id, "web-berners-lee-cern");
  assert.equal(puzzle.options.length, 4);
  assert.equal(puzzle.options.find((item) => item.id === puzzle.correctOptionId)?.qid, puzzle.path[puzzle.hiddenNodeIndex].qid);
  assert.deepEqual(puzzle.relationships.map((item) => item.propertyId), ["P61", "P108"]);
  assert.ok(puzzle.relationships.every((item) => item.evidence.some((source) => source.kind === "wikidata") && item.evidence.some((source) => source.kind === "supporting")));
  assert.ok(puzzle.path.every((node) => node.wikipediaUrl?.startsWith("https://en.wikipedia.org/wiki/")));
  assert.ok(MISSING_LINK_PUZZLES.every((item) => item.status === "approved"));
  assert.ok(MISSING_LINK_PUZZLES.every((item) => item.schedulePosition === undefined && item.scheduledDate === undefined));
  assert.equal(new Set(MISSING_LINK_PUZZLES.map((item) => item.path[1].qid)).size, 19);
});

test("Phase 6C batch 1 audit accounts for every approval, rejection, source, and distractor", async () => {
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-1-review.json", import.meta.url), "utf8"));
  assert.deepEqual(audit.counts, { candidates: 20, approved: 18, rejected: 2, priorApproved: 1, cumulativeApproved: 19, remainingTo100: 81, scheduled: 0 });
  assert.equal(audit.candidates.length, 20);
  assert.equal(audit.candidates.filter((item) => item.decision === "approved").length, 18);
  assert.equal(audit.candidates.filter((item) => item.decision === "rejected").length, 2);
  assert.deepEqual(audit.candidates.filter((item) => item.decision === "rejected").map((item) => item.id).sort(), ["apollo-armstrong-nasa", "space-jam-jordan-bulls"]);
  assert.ok(audit.candidates.every((item) => item.exactPath && item.reason && item.qualifierConcerns && item.sourceEvidence.length >= 2));
  assert.ok(audit.candidates.every((item) => item.distractors.length === 3 && item.distractorValidationOutcome));
  const approvedIds = new Set(MISSING_LINK_PUZZLES.slice(1).map((item) => item.id));
  assert.deepEqual(new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id)), approvedIds);
});

test("duplicate, reversed, ambiguous, and malformed content is rejected", () => {
  const original = structuredClone(MISSING_LINK_PUZZLES[0]);
  const duplicate = { ...structuredClone(original), id: "duplicate" };
  assert.match(validateDailyPuzzleRegistry([original, duplicate]).join("\n"), /duplicate path fingerprint|near-duplicate/);
  const ambiguous = structuredClone(original); ambiguous.id = "ambiguous"; ambiguous.options[1].qid = ambiguous.options[0].qid;
  assert.match(validateDailyPuzzleRegistry([ambiguous]).join("\n"), /answer options must be unique/);
  const wrongDirection = structuredClone(original); wrongDirection.id = "wrong-direction"; wrongDirection.relationships[0].direction = "reverse";
  assert.match(validateDailyPuzzleRegistry([wrongDirection]).join("\n"), /invalid relationship/);
});

test("UTC schedule is launch-anchored, does not cycle, and handles unavailable content", () => {
  const scheduled = structuredClone(MISSING_LINK_PUZZLES[0]); scheduled.status = "scheduled"; scheduled.schedulePosition = 1;
  const launch = "2027-01-01";
  assert.equal(getDailyScheduleState(new Date("2026-12-31T23:59:59Z"), { puzzles: [scheduled], launchDate: launch }).kind, "before-launch");
  const first = getDailyScheduleState(new Date("2027-01-01T23:59:59Z"), { puzzles: [scheduled], launchDate: launch });
  assert.equal(first.kind, "available"); assert.equal(first.puzzleNumber, 1);
  assert.equal(getDailyScheduleState(new Date("2027-01-02T00:00:00Z"), { puzzles: [scheduled], launchDate: launch }).kind, "exhausted");
  const quarantined = { ...scheduled, status: "quarantined" };
  assert.equal(getDailyScheduleState(new Date("2027-01-01T00:00:00Z"), { puzzles: [quarantined], launchDate: launch }).kind, "unavailable");
  assert.equal(getUtcDateKey(new Date("2026-10-11T23:30:00-04:00")), "2026-10-12");
});

test("100-day uniqueness and launch gate require 100 validated scheduled records", () => {
  const synthetic = Array.from({ length: 100 }, (_, index) => {
    const item = structuredClone(MISSING_LINK_PUZZLES[0]); item.id = `test-${index + 1}`; item.status = "scheduled"; item.schedulePosition = index + 1;
    item.path[0].qid = `Q${1000 + index}`; item.path[0].wikidataUrl = `https://www.wikidata.org/wiki/Q${1000 + index}`;
    item.relationships[0].subjectQid = item.path[0].qid;
    item.pathFingerprint = `${item.path[0].qid}|P61:forward:Q80|P108:forward:Q42944`;
    item.reviewHistory.push({ at: "2026-10-12T00:00:00Z", from: "approved", to: "scheduled", note: "Test schedule." }); return item;
  });
  assert.deepEqual(validateDailyPuzzleRegistry(synthetic), []);
  assert.equal(getContentRunwayReport(synthetic, "2027-01-01").launchReady, true);
  assert.equal(getContentRunwayReport(MISSING_LINK_PUZZLES, null).launchReady, false);
});

test("local results, streaks, and completion are duplicate-safe", () => {
  const result = { dateKey: "2026-10-11", puzzleId: "puzzle-a", correct: true, selectedOptionId: "answer-a" };
  const first = completeDailyChallenge(EMPTY_DAILY_COMPLETION_STATE, result);
  assert.equal(first.newlyCompleted, true); assert.equal(first.state.currentStreak, 1); assert.deepEqual(getDailyResult(first.state, result.dateKey, result.puzzleId), result);
  assert.equal(completeDailyChallenge(first.state, { ...result, correct: false }).newlyCompleted, false);
  const next = completeDailyChallenge(first.state, { ...result, dateKey: "2026-10-12" }); assert.equal(next.state.currentStreak, 2); assert.equal(next.state.bestStreak, 2);
  assert.equal(getVisibleCurrentStreak(next.state, "2026-10-13"), 2); assert.equal(getVisibleCurrentStreak(next.state, "2026-10-14"), 0);
  assert.deepEqual(parseDailyCompletionState("bad-json"), { ...EMPTY_DAILY_COMPLETION_STATE, completedDates: [], results: [] });
});

test("daily analytics claims prevent duplicate events without identifiers", () => {
  const values = new Map(); const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(claimDailyAnalyticsEvent(storage, "completed", "2026-10-11", "puzzle-a"), true);
  assert.equal(claimDailyAnalyticsEvent(storage, "completed", "2026-10-11", "puzzle-a"), false);
  assert.ok([...values.keys()].every((key) => !key.includes("user") && !key.includes("http")));
});

test("daily UI is noindex while gated, accessible, spoiler-safe, and graph-independent", async () => {
  const [page, preview, component, analytics, styles] = await Promise.all([
    readFile(new URL("../app/daily/page.tsx", import.meta.url), "utf8"), readFile(new URL("../app/daily-preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8"), readFile(new URL("../lib/product-analytics.ts", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal((page.match(/<h1/g) ?? []).length, 1); assert.match(page, /robots: \{ index: runway\.launchReady/); assert.match(preview, /index: false/);
  assert.match(component, /<fieldset/); assert.match(component, /<legend/); assert.match(component, /type="radio"/); assert.match(component, /Hidden middle entity/);
  assert.match(component, /Explore the connection/); assert.match(component, /Explore the evidence/); assert.match(component, /noopener noreferrer/); assert.match(styles, /prefers-reduced-motion: reduce/);
  for (const event of ["daily_challenge_opened", "daily_challenge_answer_submitted", "daily_challenge_completed", "daily_wikipedia_link_clicked", "daily_evidence_link_clicked", "daily_challenge_result_shared", "daily_continued_exploration"]) {
    assert.match(analytics, new RegExp(`"${event}"`)); assert.match(component, new RegExp(`"${event}"`));
  }
  const beforeReveal = component.slice(0, component.indexOf("{revealed ? <div className=\"hc-daily-reveal"));
  assert.doesNotMatch(beforeReveal, /href=\{node\.wikipediaUrl/); assert.doesNotMatch(component, /answerText|fullUrl|email|userId/);
  assert.doesNotMatch(`${page}\n${component}`, /neo4j|\/api\/discover|\/api\/ingest/i);
  assert.match(component, /I solved today's connection!/); assert.doesNotMatch(component.match(/const text =[^;]+;/s)?.[0] ?? "", /correctOptionId|pathFingerprint|explanation/);
});
