import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registryBytes = await readFile(new URL("content/daily-puzzles.json", root));
const scheduleBytes = await readFile(new URL("content/daily-schedule-review.json", root));
const registry = JSON.parse(registryBytes);
const schedule = JSON.parse(scheduleBytes);
const errors = [];
const promotionNote = "Promoted from the approved Phase 6D deterministic review schedule; launch date remains separately gated.";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const byId = new Map(registry.map((puzzle) => [puzzle.id, puzzle]));
const scheduled = schedule.positions.map((id) => byId.get(id));
const difficultyEntries = Object.entries(schedule.difficultyBands ?? {});
const difficultyIds = difficultyEntries.flatMap(([, ids]) => ids);
const difficultyById = new Map(difficultyEntries.flatMap(([band, ids]) => ids.map((id) => [id, band])));
const reviewSnapshot = (puzzle) => {
  const copy = structuredClone(puzzle);
  copy.status = "approved";
  delete copy.schedulePosition;
  delete copy.scheduledDate;
  copy.reviewHistory = copy.reviewHistory.filter((event) => event.note !== promotionNote);
  return copy;
};

if (schedule.schemaVersion !== 2) errors.push("Unsupported promoted-schedule schema version.");
if (schedule.state !== "promoted" || schedule.productionAssignmentsApplied !== true) errors.push("Reviewed schedule has not been promoted.");
if (schedule.publicLaunchActivated !== false) errors.push("Schedule artifact must not claim public activation before launch configuration.");
if (schedule.launchDate !== null) errors.push("Schedule review must not configure a launch date.");
if (schedule.positions.length !== 100) errors.push(`Expected 100 review positions; found ${schedule.positions.length}.`);
if (new Set(schedule.positions).size !== schedule.positions.length) errors.push("Schedule review contains a duplicate puzzle ID.");
if (scheduled.some((puzzle) => !puzzle)) errors.push("Schedule review references an unknown puzzle ID.");
if (difficultyIds.length !== schedule.positions.length || new Set(difficultyIds).size !== difficultyIds.length) errors.push("Difficulty bands must classify every scheduled puzzle exactly once.");
if ([...schedule.positions].some((id) => !difficultyById.has(id)) || difficultyIds.some((id) => !schedule.positions.includes(id))) errors.push("Difficulty bands and schedule positions differ.");
if (scheduled.some((puzzle, index) => puzzle && (puzzle.status !== "scheduled" || puzzle.schedulePosition !== index + 1))) errors.push("Production schedule assignments do not match the reviewed order.");
if (scheduled.some((puzzle) => puzzle && !puzzle.reviewHistory.some((event) => event.note === promotionNote && event.from === "approved" && event.to === "scheduled"))) errors.push("A scheduled puzzle is missing its promotion audit event.");
if (registry.some((puzzle) => puzzle.scheduledDate !== undefined)) errors.push("Calendar dates must remain unset until the explicit UTC launch date is approved.");

if (scheduled.every(Boolean)) {
  const scheduledContentSha256 = sha256(JSON.stringify(scheduled.map(reviewSnapshot)));
  if (scheduledContentSha256 !== schedule.scheduledContentSha256) errors.push("Scheduled puzzle content or position order changed after review.");
  for (let index = 1; index < scheduled.length; index += 1) {
    const previous = scheduled[index - 1];
    const current = scheduled[index];
    if (previous.category === current.category) errors.push(`Positions ${index} and ${index + 1} repeat category ${current.category}.`);
    const previousPattern = previous.relationships.map((edge) => `${edge.propertyId}:${edge.direction}`).join(">");
    const currentPattern = current.relationships.map((edge) => `${edge.propertyId}:${edge.direction}`).join(">");
    if (previousPattern === currentPattern) errors.push(`Positions ${index} and ${index + 1} repeat relationship pattern ${currentPattern}.`);
    const previousQids = new Set(previous.path.map((node) => node.qid));
    if (current.path.some((node) => previousQids.has(node.qid))) errors.push(`Positions ${index} and ${index + 1} reuse a path entity.`);
  }
  for (let start = 0; start <= scheduled.length - 18; start += 1) {
    const categories = new Set(scheduled.slice(start, start + 18).map((puzzle) => puzzle.category));
    if (categories.size !== 9) errors.push(`Positions ${start + 1}-${start + 18} do not cover all nine categories.`);
  }
}

const categoryDistribution = Object.fromEntries(
  [...new Set(registry.map((puzzle) => puzzle.category))]
    .sort()
    .map((category) => [category, scheduled.filter((puzzle) => puzzle?.category === category).length]),
);
const difficultyDistribution = Object.fromEntries(difficultyEntries.map(([band, ids]) => [band, ids.length]));
const report = {
  ok: errors.length === 0,
  errors,
  registryCount: registry.length,
  registryApproved: registry.filter((puzzle) => puzzle.status === "approved").length,
  registryScheduled: registry.filter((puzzle) => puzzle.status === "scheduled").length,
  productionScheduleAssignments: registry.filter((puzzle) => puzzle.schedulePosition !== undefined).length,
  reviewPositions: schedule.positions.length,
  launchDateConfigured: Boolean(process.env.NEXT_PUBLIC_DAILY_LAUNCH_DATE?.trim()),
  registryFileSha256: sha256(registryBytes),
  prePromotionRegistryFileSha256: schedule.registryFileSha256,
  editorialContentMatchesReview: scheduled.every(Boolean) && sha256(JSON.stringify(scheduled.map(reviewSnapshot))) === schedule.scheduledContentSha256,
  scheduledContentSha256: scheduled.every(Boolean) ? sha256(JSON.stringify(scheduled.map(reviewSnapshot))) : null,
  categoryDistribution,
  difficultyDistribution,
  day1: schedule.positions[0] ?? null,
  day100: schedule.positions[99] ?? null,
  futureApprovedReserve: registry.filter((puzzle) => puzzle.status === "approved" && !schedule.positions.includes(puzzle.id)).length,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
