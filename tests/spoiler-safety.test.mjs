import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MISSING_LINK_PUZZLES,
  findReservedFuturePuzzleByNames,
  findReservedFuturePuzzleByQids,
  getPuzzleScheduleWindow,
  validateDailyAnswerSelection,
} from "../lib/daily-puzzles.ts";
import { toPublicDailyPuzzle } from "../lib/daily-answer-types.ts";
import {
  EDITORIAL_CONNECTIONS,
  LEGACY_PUBLIC_EDITORIAL_SLUGS,
  createEditorialPathFingerprint,
  getEditorialPublicationDecision,
} from "../lib/editorial-connections.ts";

const LAUNCH_DATE = "2026-10-15";

test("only the four owner-approved pages bypass future-puzzle holds", () => {
  assert.deepEqual([...LEGACY_PUBLIC_EDITORIAL_SLUGS].sort(), [
    "google-larry-page",
    "michael-jordan-chicago-bulls",
    "steve-jobs-apple",
    "studio-ghibli-hayao-miyazaki",
  ]);
});

test("public daily puzzle model removes answer-only fields and hidden structured identity", () => {
  const puzzle = MISSING_LINK_PUZZLES.find(({ schedulePosition }) => schedulePosition === 3);
  assert.ok(puzzle);
  const publicPuzzle = toPublicDailyPuzzle(puzzle);
  const hidden = publicPuzzle.path[publicPuzzle.hiddenNodeIndex];
  assert.deepEqual(hidden, { slotId: `hidden-${publicPuzzle.hiddenNodeIndex}`, hidden: true });
  assert.ok(publicPuzzle.options.every((option) => !Object.hasOwn(option, "qid")));
  for (const secret of ["correctOptionId", "explanation", "relationships", "pathFingerprint", "evidence"]) {
    assert.ok(!Object.hasOwn(publicPuzzle, secret));
  }
});

test("server answer validation follows the UTC schedule and rejects future or mismatched submissions", () => {
  const puzzle = MISSING_LINK_PUZZLES.find(({ schedulePosition }) => schedulePosition === 3);
  assert.ok(puzzle);
  const correct = validateDailyAnswerSelection({
    dateKey: "2026-10-17",
    puzzleId: puzzle.id,
    selectedOptionId: puzzle.correctOptionId,
    now: new Date("2026-10-17T15:00:00Z"),
    launchDate: LAUNCH_DATE,
  });
  assert.equal(correct.status, "valid");
  assert.equal(correct.correct, true);
  const incorrectOption = puzzle.options.find(({ id }) => id !== puzzle.correctOptionId);
  assert.ok(incorrectOption);
  assert.equal(validateDailyAnswerSelection({ dateKey: "2026-10-17", puzzleId: puzzle.id, selectedOptionId: incorrectOption.id, now: new Date("2026-10-17T15:00:00Z"), launchDate: LAUNCH_DATE }).correct, false);
  assert.equal(validateDailyAnswerSelection({ dateKey: "2026-10-18", puzzleId: puzzle.id, selectedOptionId: puzzle.correctOptionId, now: new Date("2026-10-17T15:00:00Z"), launchDate: LAUNCH_DATE }).status, "invalid");
  assert.equal(validateDailyAnswerSelection({ dateKey: "2026-10-17", puzzleId: "wrong-puzzle", selectedOptionId: puzzle.correctOptionId, now: new Date("2026-10-17T15:00:00Z"), launchDate: LAUNCH_DATE }).status, "unavailable");
});

test("future endpoint reservations are exact, orientation-independent, and expire after the puzzle day", () => {
  const puzzle = MISSING_LINK_PUZZLES.find(({ schedulePosition }) => schedulePosition === 5);
  assert.ok(puzzle);
  const [first, last] = [puzzle.path[0], puzzle.path.at(-1)];
  assert.equal(getPuzzleScheduleWindow(puzzle, LAUNCH_DATE)?.editorialReleaseDate, "2026-10-20");
  assert.equal(findReservedFuturePuzzleByQids(first.qid, last.qid, new Date("2026-10-19T23:59:59Z"), LAUNCH_DATE)?.id, puzzle.id);
  assert.equal(findReservedFuturePuzzleByQids(last.qid, first.qid, new Date("2026-10-19T23:59:59Z"), LAUNCH_DATE)?.id, puzzle.id);
  assert.equal(findReservedFuturePuzzleByQids(first.qid, last.qid, new Date("2026-10-20T00:00:00Z"), LAUNCH_DATE), null);
  assert.equal(findReservedFuturePuzzleByNames(first.name, last.name, new Date("2026-10-19T23:59:59Z"), LAUNCH_DATE)?.id, puzzle.id);
  assert.equal(findReservedFuturePuzzleByNames("Steve Jobs", "Apple Inc.", new Date("2026-10-19T23:59:59Z"), LAUNCH_DATE), null);
});

test("new editorial content fails closed on future direct, hidden, and prose conflicts while legacy pages remain public", () => {
  const legacyPage = EDITORIAL_CONNECTIONS.find(({ slug }) => slug === "steve-jobs-apple");
  assert.ok(legacyPage);
  const legacyDecision = getEditorialPublicationDecision(legacyPage, { now: new Date("2026-10-17T12:00:00Z"), launchDate: LAUNCH_DATE });
  assert.equal(legacyDecision.status, "public");
  assert.equal(legacyDecision.grandfathered, true);
  assert.ok(legacyDecision.conflicts.some(({ kinds }) => kinds.includes("direct-pair") && kinds.includes("hidden-entity")));

  const proposed = { ...legacyPage, slug: "proposed-apple-story" };
  const held = getEditorialPublicationDecision(proposed, { now: new Date("2026-10-17T12:00:00Z"), launchDate: LAUNCH_DATE });
  assert.equal(held.status, "held");
  assert.equal(held.reason, "future-puzzle");
  assert.equal(getEditorialPublicationDecision(proposed, { now: new Date("2026-10-20T00:00:00Z"), launchDate: LAUNCH_DATE }).status, "public");

  const nasa = EDITORIAL_CONNECTIONS.find(({ slug }) => slug === "nasa-dwight-eisenhower");
  assert.ok(nasa?.snapshot);
  const copySnapshot = { ...nasa.snapshot, headline: "Michael Jordan and the founding of NASA" };
  const copyConflict = { ...nasa, slug: "proposed-copy-conflict", snapshot: copySnapshot, pathFingerprint: createEditorialPathFingerprint(copySnapshot) };
  const copyDecision = getEditorialPublicationDecision(copyConflict, { now: new Date("2026-10-17T12:00:00Z"), launchDate: LAUNCH_DATE });
  assert.equal(copyDecision.status, "held");
  assert.equal(copyDecision.reason, "future-puzzle");
  assert.ok(copyDecision.conflicts.some(({ puzzleId, kinds }) => puzzleId === "last-dance-jordan-medal-freedom" && kinds.includes("copy-mention")));
});

test("the complete Tesla-SpaceX editorial package is spoiler safe after launch", () => {
  const connection = EDITORIAL_CONNECTIONS.find(({ slug }) => slug === "tesla-spacex");
  assert.ok(connection?.snapshot);
  const decision = getEditorialPublicationDecision(connection, {
    now: new Date("2026-10-17T16:00:00Z"),
    launchDate: LAUNCH_DATE,
  });
  assert.equal(decision.status, "public");
  assert.deepEqual(decision.conflicts, []);
  assert.deepEqual(
    connection.snapshot.path.nodes.map(({ qid }) => qid),
    ["Q478214", "Q317521", "Q193701"],
  );
  assert.deepEqual(
    connection.expectedRelationships.map(({ propertyId, pathDirection }) => [propertyId, pathDirection]),
    [["P169", "forward"], ["P169", "reverse"]],
  );
});

test("answer and reserved-pair endpoints are explicitly no-store", async () => {
  const [answerRoute, discoverRoute, connectRoute, pageData] = await Promise.all([
    readFile(new URL("../app/api/daily-answer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/discover/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/connect/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connection-page-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(answerRoute, /Cache-Control": "no-store"/);
  assert.match(answerRoute, /MAX_REQUEST_LENGTH = 1_024/);
  assert.match(discoverRoute, /findReservedFuturePuzzleByQids/);
  assert.match(connectRoute, /findReservedFuturePuzzleByNames/);
  assert.match(pageData, /findReservedFuturePuzzleByQids/);
});
