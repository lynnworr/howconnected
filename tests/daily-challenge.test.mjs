import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MISSING_LINK_PUZZLES, getContentRunwayReport, getDailyScheduleState, getSafeDailyRequestDate, getUtcDateKey, isDailyPubliclyLaunched, validateDailyPuzzleRegistry,
} from "../lib/daily-puzzles.ts";
import {
  claimDailyAnalyticsEvent, completeDailyChallenge, EMPTY_DAILY_COMPLETION_STATE, getDailyResult, getVisibleCurrentStreak, parseDailyCompletionState,
} from "../lib/daily-challenge-state.ts";

test("approved Missing Link registry validates exact paths, evidence, links, and distractors", () => {
  assert.deepEqual(validateDailyPuzzleRegistry(), []);
  assert.equal(MISSING_LINK_PUZZLES.length, 100);
  const puzzle = MISSING_LINK_PUZZLES[0];
  assert.equal(puzzle.id, "web-berners-lee-cern");
  assert.equal(puzzle.options.length, 4);
  assert.equal(puzzle.options.find((item) => item.id === puzzle.correctOptionId)?.qid, puzzle.path[puzzle.hiddenNodeIndex].qid);
  assert.deepEqual(puzzle.relationships.map((item) => item.propertyId), ["P61", "P108"]);
  assert.ok(puzzle.relationships.every((item) => item.evidence.some((source) => source.kind === "wikidata") && item.evidence.some((source) => source.kind === "supporting")));
  assert.ok(puzzle.path.every((node) => node.wikipediaUrl?.startsWith("https://en.wikipedia.org/wiki/")));
  assert.ok(MISSING_LINK_PUZZLES.every((item) => item.status === "scheduled"));
  assert.deepEqual(MISSING_LINK_PUZZLES.map((item) => item.schedulePosition).sort((left, right) => left - right), Array.from({ length: 100 }, (_, index) => index + 1));
  assert.ok(MISSING_LINK_PUZZLES.every((item) => item.scheduledDate === undefined));
  assert.equal(new Set(MISSING_LINK_PUZZLES.map((item) => item.path[1].qid)).size, 100);
});

test("Phase 6C batch 5 reaches the 100-puzzle content gate with a complete audit", async () => {
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-5-review.json", import.meta.url), "utf8"));
  assert.deepEqual(audit.counts, { candidates: 30, approved: 25, rejected: 5, priorApproved: 75, cumulativeApproved: 100, remainingTo100: 0, scheduled: 0 });
  assert.deepEqual(audit.categoryTargets, { "Entertainment and film": 7, "History and politics": 6, "Geography and world culture": 4, Technology: 3, Business: 3, "Science and innovation": 2, Sports: 2, Music: 2, "Literature and art": 1 });
  assert.equal(audit.candidates.length, 30);
  assert.deepEqual(audit.candidates.filter((item) => item.decision === "rejected").map((item) => item.id).sort(), ["anne-frank-house-montessori", "jackie-robinson-day-dodgers", "mount-rushmore-borglum-stone-mountain", "napoleon-theorem-emperor", "nobel-peace-nobel-dynamite"]);
  assert.ok(audit.candidates.every((item) => item.exactPath && item.reason && item.qualifierConcerns && item.sourceEvidence.length >= 2));
  assert.ok(audit.candidates.every((item) => item.wikipediaLinks.length === 3 && item.distractors.length === 3 && item.distractorValidationOutcome));
  const batchIds = new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id));
  assert.equal(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).length, 25);
  assert.ok(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).every((item) => item.reviewedAt === "2026-10-12T00:00:00.000Z" && item.verificationDate === "2026-10-12"));
});

test("Phase 6C batch 4 audit accounts for every approval, rejection, source, qualifier review, and distractor", async () => {
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-4-review.json", import.meta.url), "utf8"));
  assert.deepEqual(audit.counts, { candidates: 20, approved: 19, rejected: 1, priorApproved: 56, cumulativeApproved: 75, remainingTo100: 25, scheduled: 0 });
  assert.deepEqual(audit.categoryTargets, { Technology: 5, Business: 4, Music: 3, Sports: 3, "Science and innovation": 3, "World history or culture": 2 });
  assert.equal(audit.candidates.length, 20);
  assert.deepEqual(audit.candidates.filter((item) => item.decision === "rejected").map((item) => item.id), ["machu-picchu-bingham-yale"]);
  assert.ok(audit.candidates.every((item) => item.exactPath && item.reason && item.qualifierConcerns && item.sourceEvidence.length >= 2));
  assert.ok(audit.candidates.every((item) => item.distractors.length === 3 && item.distractorValidationOutcome));
  const batchIds = new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id));
  assert.equal(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).length, 19);
  assert.ok(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).every((item) => item.reviewedAt === "2026-10-12T00:00:00.000Z" && item.verificationDate === "2026-10-12"));
});

test("Phase 6C batch 3 audit accounts for every approval, rejection, source, qualifier review, and distractor", async () => {
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-3-review.json", import.meta.url), "utf8"));
  assert.deepEqual(audit.counts, { candidates: 20, approved: 19, rejected: 1, priorApproved: 37, cumulativeApproved: 56, remainingTo100: 44, scheduled: 0 });
  assert.deepEqual(audit.categoryTargets, { Sports: 6, "Geography and culture": 6, "History and politics": 3, "Science and innovation": 2, Music: 2, "Entertainment and film": 1 });
  assert.equal(audit.candidates.length, 20);
  assert.deepEqual(audit.candidates.filter((item) => item.decision === "rejected").map((item) => item.id), ["paris-1924-liddell-edinburgh"]);
  assert.ok(audit.candidates.every((item) => item.exactPath && item.reason && item.qualifierConcerns && item.sourceEvidence.length >= 2));
  assert.ok(audit.candidates.every((item) => item.distractors.length === 3 && item.distractorValidationOutcome));
  const batchIds = new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id));
  assert.equal(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).length, 19);
  assert.ok(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).every((item) => item.reviewedAt === "2026-10-12T00:00:00.000Z" && item.verificationDate === "2026-10-12"));
});

test("Phase 6C batch 2 audit accounts for every approval, rejection, source, qualifier review, and distractor", async () => {
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-2-review.json", import.meta.url), "utf8"));
  assert.deepEqual(audit.counts, { candidates: 20, approved: 18, rejected: 2, priorApproved: 19, cumulativeApproved: 37, remainingTo100: 63, scheduled: 0 });
  assert.equal(audit.candidates.length, 20);
  assert.equal(audit.candidates.filter((item) => item.decision === "approved").length, 18);
  assert.deepEqual(audit.candidates.filter((item) => item.decision === "rejected").map((item) => item.id).sort(), ["berkshire-buffett-giving-pledge", "blind-side-oher-ravens"]);
  assert.ok(audit.candidates.every((item) => item.exactPath && item.reason && item.qualifierConcerns && item.sourceEvidence.length >= 2));
  assert.ok(audit.candidates.every((item) => item.distractors.length === 3 && item.distractorValidationOutcome));
  const batchIds = new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id));
  assert.equal(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).length, 18);
  assert.ok(MISSING_LINK_PUZZLES.filter((item) => batchIds.has(item.id)).every((item) => item.reviewedAt === "2026-10-12T00:00:00.000Z" && item.verificationDate === "2026-10-12"));
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
  const approvedIds = new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id));
  assert.deepEqual(new Set(MISSING_LINK_PUZZLES.filter((item) => approvedIds.has(item.id)).map((item) => item.id)), approvedIds);
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

test("public launch and requested-date gates follow UTC and never expose future puzzles", () => {
  const launch = "2027-01-01";
  assert.equal(isDailyPubliclyLaunched(new Date("2026-12-31T23:59:59.999Z"), MISSING_LINK_PUZZLES, launch), false);
  assert.equal(isDailyPubliclyLaunched(new Date("2027-01-01T00:00:00.000Z"), MISSING_LINK_PUZZLES, launch), true);
  assert.equal(isDailyPubliclyLaunched(new Date("2027-01-01T00:00:00.000Z"), MISSING_LINK_PUZZLES, null), false);
  const now = new Date("2027-01-12T03:00:00.000Z");
  assert.equal(getSafeDailyRequestDate("2027-01-13", now), now);
  assert.equal(getUtcDateKey(getSafeDailyRequestDate("2027-01-11", now)), "2027-01-11");
  assert.equal(getSafeDailyRequestDate("not-a-date", now), now);
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
  assert.equal(getContentRunwayReport(MISSING_LINK_PUZZLES, "2027-01-01").launchReady, true);
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
  const [page, preview, component, schema, styles] = await Promise.all([
    readFile(new URL("../app/daily/page.tsx", import.meta.url), "utf8"), readFile(new URL("../app/daily-preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8"), readFile(new URL("../lib/product-analytics-schema.ts", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal((page.match(/<h1/g) ?? []).length, 1); assert.match(page, /robots: \{ index: isDailyPubliclyLaunched\(\)/); assert.match(preview, /index: false/);
  assert.doesNotMatch(page, /previewWhenUnconfigured: true/);
  assert.match(component, /const analyticsEnabled = !preview/);
  assert.match(component, /if \(!analyticsEnabled\) return/);
  assert.match(component, /return analyticsEnabled && claimDailyAnalyticsEvent/);
  assert.match(component, /<fieldset/); assert.match(component, /<legend/); assert.match(component, /type="radio"/); assert.match(component, /Hidden middle entity/);
  assert.match(component, /Explore the connection/); assert.match(component, /Explore the evidence/); assert.match(component, /noopener noreferrer/); assert.match(styles, /prefers-reduced-motion: reduce/);
  for (const event of ["daily_challenge_opened", "daily_challenge_answer_submitted", "daily_challenge_completed", "daily_wikipedia_link_clicked", "daily_evidence_link_clicked", "daily_challenge_result_shared", "daily_continued_exploration"]) {
    assert.match(schema, new RegExp(`"${event}"`)); assert.match(component, new RegExp(`"${event}"`));
  }
  const beforeReveal = component.slice(0, component.indexOf("{revealed ? <div className=\"hc-daily-reveal"));
  assert.doesNotMatch(beforeReveal, /href=\{node\.wikipediaUrl/); assert.doesNotMatch(component, /answerText|fullUrl|email|userId/);
  assert.doesNotMatch(`${page}\n${component}`, /neo4j|\/api\/discover|\/api\/ingest/i);
  assert.match(component, /I solved today's connection!/); assert.doesNotMatch(component.match(/const text =[^;]+;/s)?.[0] ?? "", /correctOptionId|pathFingerprint|explanation/);
});
