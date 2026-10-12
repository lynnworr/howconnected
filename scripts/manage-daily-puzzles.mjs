import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const registryPath = resolve("content/daily-puzzles.json");
const queuePath = resolve("content/daily-review-queue.json");
const statuses = new Set(["candidate", "under-review", "approved", "scheduled", "published", "quarantined", "retired", "rejected"]);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const command = process.argv[2] ?? "report";
const puzzles = await readJson(registryPath);

if (command === "validate") {
  const { validateDailyPuzzleRegistry } = await import("../lib/daily-puzzles.ts");
  const errors = validateDailyPuzzleRegistry(puzzles);
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  else console.log(`Validated ${puzzles.length} puzzle record(s).`);
} else if (command === "duplicates") {
  const exact = new Map(); const near = new Map(); const findings = [];
  for (const puzzle of puzzles) {
    const exactKey = puzzle.pathFingerprint;
    const endpointKey = [puzzle.path[0]?.qid, puzzle.path.at(-1)?.qid].sort().join(":");
    const nearKey = `${endpointKey}|${puzzle.path[puzzle.hiddenNodeIndex]?.qid}|${puzzle.relationships.map((item) => item.propertyId).sort().join(":")}`;
    if (exact.has(exactKey)) findings.push(`Exact duplicate: ${exact.get(exactKey)} and ${puzzle.id}`); else exact.set(exactKey, puzzle.id);
    if (near.has(nearKey)) findings.push(`Near/reversed duplicate: ${near.get(nearKey)} and ${puzzle.id}`); else near.set(nearKey, puzzle.id);
  }
  if (findings.length) { console.error(findings.join("\n")); process.exitCode = 1; }
  else console.log(`No exact, reversed, or near-duplicate paths across ${puzzles.length} puzzle record(s).`);
} else if (command === "report") {
  const counts = Object.fromEntries([...statuses].map((status) => [status, puzzles.filter((item) => item.status === status).length]));
  const approved = counts.approved + counts.scheduled + counts.published;
  const reserve = counts.approved + counts.scheduled;
  const scheduled = puzzles.filter((item) => Number.isInteger(item.schedulePosition)).sort((a, b) => a.schedulePosition - b.schedulePosition);
  const launchDate = process.env.NEXT_PUBLIC_DAILY_LAUNCH_DATE ?? null;
  const lastPosition = scheduled.at(-1)?.schedulePosition ?? 0;
  const lastDate = launchDate && lastPosition ? new Date(Date.parse(`${launchDate}T00:00:00Z`) + (lastPosition - 1) * 86400000).toISOString().slice(0, 10) : null;
  console.log(JSON.stringify({ approvedPuzzleCount: approved, scheduledPuzzleCount: counts.scheduled + counts.published, publishedPuzzleCount: counts.published,
    unpublishedReserve: reserve, candidatesAwaitingReview: counts.candidate + counts["under-review"], rejectedCount: counts.rejected,
    quarantinedCount: counts.quarantined, daysRemainingBeforeExhaustion: reserve, lastScheduledPuzzleDate: lastDate,
    warning: reserve < 30 ? "Fewer than 30 unpublished approved puzzles remain." : null, launchReady: approved >= 100 && scheduled.length >= 100 && Boolean(launchDate) }, null, 2));
} else if (command === "export-review") {
  const queue = puzzles.filter((item) => item.status === "candidate" || item.status === "under-review"); await writeJson(queuePath, queue);
  console.log(`Exported ${queue.length} record(s) to ${queuePath}.`);
} else if (command === "set-status") {
  const [id, nextStatus, note] = process.argv.slice(3); if (!id || !statuses.has(nextStatus) || !note) throw new Error("Usage: set-status <id> <status> <review-note>");
  const puzzle = puzzles.find((item) => item.id === id); if (!puzzle) throw new Error(`Unknown puzzle: ${id}`);
  const previous = puzzle.status; puzzle.status = nextStatus; puzzle.reviewHistory ??= [];
  puzzle.reviewHistory.push({ at: new Date().toISOString(), from: previous, to: nextStatus, note });
  if (!["scheduled", "published", "quarantined", "retired"].includes(nextStatus)) { delete puzzle.schedulePosition; delete puzzle.scheduledDate; }
  await writeJson(registryPath, puzzles); console.log(`${id}: ${previous} -> ${nextStatus}`);
} else if (command === "schedule") {
  const [id, rawPosition] = process.argv.slice(3); const position = Number(rawPosition);
  if (!id || !Number.isInteger(position) || position < 1) throw new Error("Usage: schedule <id> <positive-position>");
  const puzzle = puzzles.find((item) => item.id === id); if (!puzzle || !["approved", "scheduled"].includes(puzzle.status)) throw new Error("Puzzle must exist and be approved.");
  if (puzzles.some((item) => item.id !== id && item.schedulePosition === position)) throw new Error(`Schedule position ${position} is already assigned.`);
  const previous = puzzle.status; puzzle.status = "scheduled"; puzzle.schedulePosition = position;
  const launchDate = process.env.NEXT_PUBLIC_DAILY_LAUNCH_DATE; if (launchDate) puzzle.scheduledDate = new Date(Date.parse(`${launchDate}T00:00:00Z`) + (position - 1) * 86400000).toISOString().slice(0, 10);
  puzzle.reviewHistory.push({ at: new Date().toISOString(), from: previous, to: "scheduled", note: `Assigned immutable schedule position ${position}.` });
  await writeJson(registryPath, puzzles); console.log(`${id} scheduled at position ${position}.`);
} else if (command === "discover") {
  if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) throw new Error("Neo4j credentials are required for bounded discovery.");
  const neo4j = await import("neo4j-driver"); const driver = neo4j.default.driver(process.env.NEO4J_URI, neo4j.default.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
  try {
    const result = await driver.executeQuery("MATCH p=(a:Entity)-[r1]-(middle:Entity)-[r2]-(b:Entity) WHERE a.qid < b.qid AND a.qid <> middle.qid AND b.qid <> middle.qid RETURN [n IN nodes(p) | {qid:n.qid, name:n.name}] AS path, [r IN relationships(p) | type(r)] AS properties LIMIT $limit", { limit: neo4j.default.int(50) });
    const candidates = result.records.map((record, index) => ({ discoveryId: `graph-${Date.now()}-${index + 1}`, status: "candidate", path: record.get("path"), properties: record.get("properties"), editorialApproval: false }));
    await writeJson(queuePath, candidates); console.log(`Exported ${candidates.length} graph candidate(s). No candidate was approved automatically.`);
  } finally { await driver.close(); }
} else {
  throw new Error("Commands: validate, duplicates, report, discover, export-review, set-status, schedule");
}
