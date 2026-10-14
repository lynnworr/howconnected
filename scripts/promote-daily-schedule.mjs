import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const registryUrl = new URL("../content/daily-puzzles.json", import.meta.url);
const scheduleUrl = new URL("../content/daily-schedule-review.json", import.meta.url);
const registry = JSON.parse(await readFile(registryUrl, "utf8"));
const schedule = JSON.parse(await readFile(scheduleUrl, "utf8"));
const promotionNote = "Promoted from the approved Phase 6D deterministic review schedule; launch date remains separately gated.";
const promotionAt = "2026-10-14T20:00:00.000Z";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function reviewSnapshot(puzzle) {
  const copy = structuredClone(puzzle);
  copy.status = "approved";
  delete copy.schedulePosition;
  delete copy.scheduledDate;
  copy.reviewHistory = copy.reviewHistory.filter((event) => event.note !== promotionNote);
  return copy;
}

if (schedule.positions.length !== 100 || new Set(schedule.positions).size !== 100) throw new Error("The reviewed schedule must contain 100 unique IDs.");
if (schedule.positions[0] !== "toy-story-hanks-apollo-13" || schedule.positions[99] !== "muppet-show-henson-maryland") throw new Error("The reviewed day-1 or day-100 assignment changed.");
if (registry.length !== 100 || new Set(registry.map((puzzle) => puzzle.id)).size !== 100) throw new Error("The production registry must contain 100 unique records.");
const byId = new Map(registry.map((puzzle) => [puzzle.id, puzzle]));
if (schedule.positions.some((id) => !byId.has(id))) throw new Error("The reviewed schedule references an unknown registry ID.");
const snapshotHash = sha256(JSON.stringify(schedule.positions.map((id) => reviewSnapshot(byId.get(id)))));
if (snapshotHash !== schedule.scheduledContentSha256) throw new Error("Approved content or reviewed order changed after Phase 6D.");

for (const [index, id] of schedule.positions.entries()) {
  const puzzle = byId.get(id);
  const position = index + 1;
  if (puzzle.schedulePosition !== undefined && puzzle.schedulePosition !== position) throw new Error(`${id} already has a different schedule position.`);
  if (!["approved", "scheduled"].includes(puzzle.status)) throw new Error(`${id} cannot be promoted from status ${puzzle.status}.`);
  puzzle.status = "scheduled";
  puzzle.schedulePosition = position;
  delete puzzle.scheduledDate;
  if (!puzzle.reviewHistory.some((event) => event.note === promotionNote)) {
    puzzle.reviewHistory.push({ at: promotionAt, from: "approved", to: "scheduled", note: promotionNote });
  }
}

await writeFile(registryUrl, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Promoted ${schedule.positions.length} reviewed puzzles to immutable production schedule positions. Launch date remains unset.`);
