import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MISSING_LINK_PUZZLES,
  getDailyScheduleState,
  getScheduledPuzzles,
  validateDailyPuzzleRegistry,
} from "../lib/daily-puzzles.ts";
import { completeDailyChallenge, EMPTY_DAILY_COMPLETION_STATE } from "../lib/daily-challenge-state.ts";

const reviewSchedule = JSON.parse(await readFile(new URL("../content/daily-schedule-review.json", import.meta.url), "utf8"));
const registryById = new Map(MISSING_LINK_PUZZLES.map((puzzle) => [puzzle.id, puzzle]));

function materializeReviewSchedule() {
  return reviewSchedule.positions.map((id) => structuredClone(registryById.get(id)));
}

function utcDateAt(launchDate, offset) {
  return new Date(Date.parse(`${launchDate}T00:00:00.000Z`) + offset * 86_400_000);
}

test("Phase 6E promotes every reviewed puzzle exactly once without activating the public date gate", () => {
  assert.equal(reviewSchedule.state, "promoted");
  assert.equal(reviewSchedule.productionAssignmentsApplied, true);
  assert.equal(reviewSchedule.publicLaunchActivated, false);
  assert.equal(reviewSchedule.launchDate, null);
  assert.equal(reviewSchedule.positions.length, 100);
  assert.equal(new Set(reviewSchedule.positions).size, 100);
  assert.deepEqual(new Set(reviewSchedule.positions), new Set(MISSING_LINK_PUZZLES.map((puzzle) => puzzle.id)));
  assert.ok(MISSING_LINK_PUZZLES.every((puzzle) => puzzle.status === "scheduled" && puzzle.schedulePosition === reviewSchedule.positions.indexOf(puzzle.id) + 1 && puzzle.scheduledDate === undefined));
});

test("schedule promotion preserves the original 75 editorial records", () => {
  const promotionNote = "Promoted from the approved Phase 6D deterministic review schedule; launch date remains separately gated.";
  const editorialPrefix = MISSING_LINK_PUZZLES.slice(0, 75).map((puzzle) => {
    const copy = structuredClone(puzzle);
    copy.status = "approved";
    delete copy.schedulePosition;
    delete copy.scheduledDate;
    copy.reviewHistory = copy.reviewHistory.filter((event) => event.note !== promotionNote);
    return copy;
  });
  assert.equal(createHash("sha256").update(JSON.stringify(editorialPrefix)).digest("hex"), "f0c3b95542bf479d27a2f2f45a4066f610ea7a061613373fe3953fed4b6e872e");
});

test("review order is registry-valid and exposes days 1 through 100 exactly once", () => {
  const scheduled = materializeReviewSchedule();
  assert.deepEqual(validateDailyPuzzleRegistry(scheduled), []);
  assert.deepEqual(getScheduledPuzzles(scheduled).map((puzzle) => puzzle.id), reviewSchedule.positions);
  assert.deepEqual(getScheduledPuzzles(scheduled).map((puzzle) => puzzle.schedulePosition), Array.from({ length: 100 }, (_, index) => index + 1));
});

test("100-day simulation handles before launch, UTC rollover, exhaustion, and time-zone consistency", () => {
  const scheduled = materializeReviewSchedule();
  const launchDate = "2027-03-01";
  assert.equal(getDailyScheduleState(utcDateAt(launchDate, -1), { puzzles: scheduled, launchDate }).kind, "before-launch");
  const day1 = getDailyScheduleState(new Date("2027-03-01T00:00:00.000Z"), { puzzles: scheduled, launchDate });
  assert.equal(day1.kind, "available");
  assert.equal(day1.puzzleNumber, 1);
  assert.equal(day1.puzzle.id, reviewSchedule.positions[0]);
  const day100 = getDailyScheduleState(utcDateAt(launchDate, 99), { puzzles: scheduled, launchDate });
  assert.equal(day100.kind, "available");
  assert.equal(day100.puzzleNumber, 100);
  assert.equal(day100.puzzle.id, reviewSchedule.positions[99]);
  const day101 = getDailyScheduleState(utcDateAt(launchDate, 100), { puzzles: scheduled, launchDate });
  assert.equal(day101.kind, "exhausted");
  assert.equal(day101.lastScheduledDate, utcDateAt(launchDate, 99).toISOString().slice(0, 10));
  const sameInstant = [
    new Date("2027-03-12T00:30:00.000Z"),
    new Date("2027-03-11T19:30:00-05:00"),
    new Date("2027-03-12T09:30:00+09:00"),
  ].map((date) => getDailyScheduleState(date, { puzzles: scheduled, launchDate }));
  assert.ok(sameInstant.every((state) => state.kind === "available" && state.puzzleNumber === 12 && state.puzzle.id === reviewSchedule.positions[11]));
  assert.equal(getDailyScheduleState(new Date("2027-03-11T23:59:59.999Z"), { puzzles: scheduled, launchDate }).puzzleNumber, 11);
  assert.equal(getDailyScheduleState(new Date("2027-03-12T00:00:00.000Z"), { puzzles: scheduled, launchDate }).puzzleNumber, 12);
});

test("future approvals cannot shift reviewed assignments and quarantine does not substitute content", () => {
  const scheduled = materializeReviewSchedule();
  const future = structuredClone(MISSING_LINK_PUZZLES[0]);
  future.id = "future-approved-puzzle";
  future.status = "approved";
  delete future.schedulePosition;
  const extended = [...scheduled, future];
  assert.deepEqual(getScheduledPuzzles(extended).map((puzzle) => puzzle.id), reviewSchedule.positions);
  const launchDate = "2027-03-01";
  const quarantined = structuredClone(scheduled);
  quarantined[41].status = "quarantined";
  const unavailable = getDailyScheduleState(utcDateAt(launchDate, 41), { puzzles: quarantined, launchDate });
  assert.deepEqual(unavailable, { kind: "unavailable", dateKey: "2027-04-11", reason: "quarantined" });
  assert.equal(getDailyScheduleState(utcDateAt(launchDate, 42), { puzzles: quarantined, launchDate }).puzzle.id, reviewSchedule.positions[42]);
});

test("one completion per scheduled day produces a 100-day local streak without duplicate inflation", () => {
  let state = structuredClone(EMPTY_DAILY_COMPLETION_STATE);
  const launchDate = "2027-03-01";
  for (const [index, puzzleId] of reviewSchedule.positions.entries()) {
    const dateKey = utcDateAt(launchDate, index).toISOString().slice(0, 10);
    const result = { dateKey, puzzleId, correct: true, selectedOptionId: registryById.get(puzzleId).correctOptionId };
    const completion = completeDailyChallenge(state, result);
    assert.equal(completion.newlyCompleted, true);
    state = completion.state;
    assert.equal(completeDailyChallenge(state, result).newlyCompleted, false);
  }
  assert.equal(state.completedDates.length, 100);
  assert.equal(state.results.length, 100);
  assert.equal(state.currentStreak, 100);
  assert.equal(state.bestStreak, 100);
});
