import puzzleContent from "../content/daily-puzzles.json" with { type: "json" };

export const PUZZLE_STATUSES = ["candidate", "under-review", "approved", "scheduled", "published", "quarantined", "retired", "rejected"] as const;
export type PuzzleStatus = (typeof PUZZLE_STATUSES)[number];
export type PuzzleCategory = "Science and innovation" | "History and politics" | "Entertainment and film" | "Music" | "Sports" | "Business" | "Technology" | "Geography and culture" | "Literature and art";
export type PuzzleNode = { qid: string; name: string; wikipediaUrl?: string; wikidataUrl: string };
export type PuzzleQualifier = { propertyId: string; label: string; value: string };
export type PuzzleEvidence = { label: string; publisher: string; url: string; kind: "wikidata" | "supporting" };
export type PuzzleRelationship = {
  propertyId: string; subjectQid: string; objectQid: string; direction: "forward" | "reverse"; label: string;
  qualifiers: readonly PuzzleQualifier[]; expectedClaim: string; evidence: readonly PuzzleEvidence[];
};
export type MissingLinkPuzzle = {
  id: string; format: "missing-link"; title: string; prompt: string; category: PuzzleCategory; status: PuzzleStatus;
  path: readonly PuzzleNode[]; hiddenNodeIndex: number; relationships: readonly PuzzleRelationship[];
  options: readonly { id: string; label: string; qid: string }[]; correctOptionId: string; explanation: string;
  pathFingerprint: string; reviewedAt: string; verificationDate: string; schedulePosition?: number; scheduledDate?: string;
  reviewHistory: readonly { at: string; from: PuzzleStatus | null; to: PuzzleStatus; note: string }[];
};
export type GuessConnectionPuzzle = {
  id: string; format: "guess-connection"; prompt: string; source: PuzzleNode; target: PuzzleNode;
  relationship: PuzzleRelationship; options: readonly { id: string; label: string }[]; correctOptionId: string;
  explanation: string; reviewedAt: string;
};
export type DailyPuzzle = MissingLinkPuzzle | GuessConnectionPuzzle;
export type ScheduleState =
  | { kind: "before-launch"; launchDate: string }
  | { kind: "available"; dateKey: string; puzzleNumber: number; puzzle: MissingLinkPuzzle }
  | { kind: "unavailable"; dateKey: string; reason: "missing" | "quarantined" | "retired" }
  | { kind: "exhausted"; dateKey: string; lastScheduledDate: string | null }
  | { kind: "preview"; dateKey: string; puzzle: MissingLinkPuzzle };

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const QID_PATTERN = /^Q[1-9]\d*$/;
const PROPERTY_PATTERN = /^P[1-9]\d*$/;
const HTTPS_WIKIPEDIA_PATTERN = /^https:\/\/en\.wikipedia\.org\/wiki\//;

export const MISSING_LINK_PUZZLES = puzzleContent as readonly MissingLinkPuzzle[];
export const DAILY_PUZZLES = MISSING_LINK_PUZZLES;

const NODE = {
  apollo11: { qid: "Q43653", name: "Apollo 11", wikipediaUrl: "https://en.wikipedia.org/wiki/Apollo_11", wikidataUrl: "https://www.wikidata.org/wiki/Q43653" },
  armstrong: { qid: "Q1615", name: "Neil Armstrong", wikipediaUrl: "https://en.wikipedia.org/wiki/Neil_Armstrong", wikidataUrl: "https://www.wikidata.org/wiki/Q1615" },
} as const;

export const EXPERIMENTAL_GUESS_PUZZLES: readonly GuessConnectionPuzzle[] = [{
  id: "apollo-11-armstrong-role", format: "guess-connection",
  prompt: "What verified relationship connects Apollo 11 and Neil Armstrong?", source: NODE.apollo11, target: NODE.armstrong,
  relationship: {
    propertyId: "P1029", subjectQid: "Q43653", objectQid: "Q1615", direction: "forward", label: "crew member",
    qualifiers: [{ propertyId: "P39", label: "position held", value: "spacecraft commander" }],
    expectedClaim: "Q43653 P1029 Q1615, qualified by P39 spacecraft commander",
    evidence: [
      { label: "Apollo 11 crew statement (P1029)", publisher: "Wikidata", url: "https://www.wikidata.org/wiki/Q43653#P1029", kind: "wikidata" },
      { label: "Apollo 11 mission overview", publisher: "NASA", url: "https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/", kind: "supporting" },
    ],
  },
  options: [
    { id: "commander", label: "Armstrong was a crew member and spacecraft commander." },
    { id: "designer", label: "Armstrong is identified as the spacecraft's designer." },
    { id: "namesake", label: "The mission was named after Armstrong." },
  ],
  correctOptionId: "commander",
  explanation: "Apollo 11's crew statement identifies Neil Armstrong as a crew member, with a qualifier specifying spacecraft commander.",
  reviewedAt: "2026-10-11T00:00:00.000Z",
}];

function safeHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function normalizedFingerprint(puzzle: MissingLinkPuzzle): string {
  return puzzle.path.map((node, index) => index === 0 ? node.qid : `${puzzle.relationships[index - 1].propertyId}:${puzzle.relationships[index - 1].direction}:${node.qid}`).join("|");
}
function nearDuplicateFingerprint(puzzle: MissingLinkPuzzle): string {
  const endpoints = [puzzle.path[0]?.qid, puzzle.path.at(-1)?.qid].sort().join(":");
  return `${endpoints}|${puzzle.path[puzzle.hiddenNodeIndex]?.qid}|${puzzle.relationships.map((item) => item.propertyId).sort().join(":")}`;
}

export function validateDailyPuzzleRegistry(puzzles: readonly MissingLinkPuzzle[] = MISSING_LINK_PUZZLES): string[] {
  const errors: string[] = [];
  const ids = new Set<string>(); const fingerprints = new Set<string>(); const nearDuplicates = new Set<string>(); const positions = new Set<number>();
  for (const puzzle of puzzles) {
    if (!puzzle.id.trim() || ids.has(puzzle.id)) errors.push(`Duplicate or empty puzzle ID: ${puzzle.id}`); ids.add(puzzle.id);
    if (puzzle.format !== "missing-link") errors.push(`${puzzle.id}: primary registry only accepts missing-link puzzles`);
    if (!PUZZLE_STATUSES.includes(puzzle.status)) errors.push(`${puzzle.id}: invalid status`);
    if (!puzzle.title.trim() || !puzzle.prompt.trim() || !puzzle.explanation.trim()) errors.push(`${puzzle.id}: missing editorial copy`);
    if (!DATE_KEY_PATTERN.test(puzzle.verificationDate) || Number.isNaN(Date.parse(`${puzzle.verificationDate}T00:00:00Z`))) errors.push(`${puzzle.id}: invalid verification date`);
    if (Number.isNaN(Date.parse(puzzle.reviewedAt))) errors.push(`${puzzle.id}: invalid review date`);
    if (puzzle.path.length < 3 || puzzle.path.length > 4 || puzzle.hiddenNodeIndex <= 0 || puzzle.hiddenNodeIndex >= puzzle.path.length - 1) errors.push(`${puzzle.id}: invalid path shape`);
    if (puzzle.relationships.length !== puzzle.path.length - 1) errors.push(`${puzzle.id}: relationship count does not match path`);
    if (puzzle.options.length !== 4) errors.push(`${puzzle.id}: exactly four answer options are required`);
    if (new Set(puzzle.options.map((option) => option.id)).size !== 4 || new Set(puzzle.options.map((option) => option.qid)).size !== 4) errors.push(`${puzzle.id}: answer options must be unique`);
    const correct = puzzle.options.find((option) => option.id === puzzle.correctOptionId);
    if (!correct || correct.qid !== puzzle.path[puzzle.hiddenNodeIndex]?.qid) errors.push(`${puzzle.id}: correct option does not match hidden node`);
    if (puzzle.options.some((option) => !QID_PATTERN.test(option.qid) || !option.label.trim())) errors.push(`${puzzle.id}: invalid answer option`);
    for (const [index, node] of puzzle.path.entries()) {
      if (!QID_PATTERN.test(node.qid) || !node.name.trim() || !safeHttpsUrl(node.wikidataUrl)) errors.push(`${puzzle.id}: invalid path node ${index + 1}`);
      if (node.wikipediaUrl && !HTTPS_WIKIPEDIA_PATTERN.test(node.wikipediaUrl)) errors.push(`${puzzle.id}: Wikipedia link must be a verified English article URL`);
    }
    for (const [index, relationship] of puzzle.relationships.entries()) {
      const from = puzzle.path[index]; const to = puzzle.path[index + 1];
      const expectedSubject = relationship.direction === "forward" ? from?.qid : to?.qid;
      const expectedObject = relationship.direction === "forward" ? to?.qid : from?.qid;
      if (!PROPERTY_PATTERN.test(relationship.propertyId) || relationship.subjectQid !== expectedSubject || relationship.objectQid !== expectedObject || !relationship.label.trim() || !relationship.expectedClaim.trim()) errors.push(`${puzzle.id}: invalid relationship ${index + 1}`);
      if (relationship.qualifiers.some((item) => !PROPERTY_PATTERN.test(item.propertyId) || !item.label.trim() || !item.value.trim())) errors.push(`${puzzle.id}: invalid qualifier on relationship ${index + 1}`);
      if (!relationship.evidence.some((item) => item.kind === "wikidata") || !relationship.evidence.some((item) => item.kind === "supporting") || relationship.evidence.some((item) => !item.label.trim() || !item.publisher.trim() || !safeHttpsUrl(item.url))) errors.push(`${puzzle.id}: relationship ${index + 1} needs Wikidata and supporting evidence`);
    }
    const fingerprint = normalizedFingerprint(puzzle); if (puzzle.pathFingerprint !== fingerprint) errors.push(`${puzzle.id}: stale path fingerprint`);
    if (fingerprints.has(fingerprint)) errors.push(`${puzzle.id}: duplicate path fingerprint`); fingerprints.add(fingerprint);
    const nearDuplicate = nearDuplicateFingerprint(puzzle); if (nearDuplicates.has(nearDuplicate)) errors.push(`${puzzle.id}: near-duplicate or reversed path`); nearDuplicates.add(nearDuplicate);
    if (["approved", "scheduled", "published"].includes(puzzle.status) && !puzzle.reviewHistory.some((item) => item.to === "approved")) errors.push(`${puzzle.id}: approved content needs an approval event`);
    if (puzzle.schedulePosition !== undefined) {
      if (!Number.isInteger(puzzle.schedulePosition) || puzzle.schedulePosition < 1 || positions.has(puzzle.schedulePosition)) errors.push(`${puzzle.id}: invalid or duplicate schedule position`);
      positions.add(puzzle.schedulePosition);
      if (!["scheduled", "published", "quarantined", "retired"].includes(puzzle.status)) errors.push(`${puzzle.id}: this status may not retain a schedule position`);
    }
  }
  [...positions].sort((a, b) => a - b).forEach((position, index) => { if (position !== index + 1) errors.push(`Schedule has a gap before position ${position}`); });
  return errors;
}

export function getUtcDateKey(date: Date): string { if (Number.isNaN(date.getTime())) throw new Error("A valid date is required."); return date.toISOString().slice(0, 10); }
function utcDay(dateKey: string): number { if (!DATE_KEY_PATTERN.test(dateKey)) return Number.NaN; return Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000); }
export function getConfiguredLaunchDate(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.NEXT_PUBLIC_DAILY_LAUNCH_DATE?.trim() ?? ""; return DATE_KEY_PATTERN.test(value) && Number.isFinite(utcDay(value)) ? value : null;
}
export function getScheduledPuzzles(puzzles: readonly MissingLinkPuzzle[] = MISSING_LINK_PUZZLES): MissingLinkPuzzle[] {
  return puzzles.filter((puzzle) => puzzle.schedulePosition !== undefined).sort((a, b) => (a.schedulePosition ?? 0) - (b.schedulePosition ?? 0));
}
export function getDailyScheduleState(date: Date, options: { puzzles?: readonly MissingLinkPuzzle[]; launchDate?: string | null; previewWhenUnconfigured?: boolean } = {}): ScheduleState {
  const puzzles = options.puzzles ?? MISSING_LINK_PUZZLES; const dateKey = getUtcDateKey(date);
  const launchDate = options.launchDate === undefined ? getConfiguredLaunchDate() : options.launchDate;
  if (!launchDate) {
    const puzzle = puzzles.find((item) => ["approved", "scheduled", "published"].includes(item.status));
    if (options.previewWhenUnconfigured && puzzle) return { kind: "preview", dateKey, puzzle };
    return { kind: "before-launch", launchDate: "not configured" };
  }
  const offset = utcDay(dateKey) - utcDay(launchDate); if (offset < 0) return { kind: "before-launch", launchDate };
  const scheduled = getScheduledPuzzles(puzzles); const puzzle = scheduled.find((item) => item.schedulePosition === offset + 1);
  if (!puzzle) {
    const lastPosition = scheduled.at(-1)?.schedulePosition ?? 0;
    const lastScheduledDate = lastPosition ? new Date((utcDay(launchDate) + lastPosition - 1) * 86_400_000).toISOString().slice(0, 10) : null;
    return { kind: "exhausted", dateKey, lastScheduledDate };
  }
  if (puzzle.status === "quarantined" || puzzle.status === "retired") return { kind: "unavailable", dateKey, reason: puzzle.status };
  if (!["scheduled", "published"].includes(puzzle.status)) return { kind: "unavailable", dateKey, reason: "missing" };
  return { kind: "available", dateKey, puzzleNumber: offset + 1, puzzle };
}
export function getDailyPuzzleForDate(date: Date, puzzles: readonly MissingLinkPuzzle[] = MISSING_LINK_PUZZLES): MissingLinkPuzzle {
  const state = getDailyScheduleState(date, { puzzles, previewWhenUnconfigured: true });
  if (state.kind === "available" || state.kind === "preview") return state.puzzle;
  throw new Error(`No playable daily puzzle: ${state.kind}`);
}
export function getComparisonPuzzle(): GuessConnectionPuzzle { const puzzle = EXPERIMENTAL_GUESS_PUZZLES[0]; if (!puzzle) throw new Error("A reviewed experimental puzzle is required."); return puzzle; }
export function getContentRunwayReport(puzzles: readonly MissingLinkPuzzle[] = MISSING_LINK_PUZZLES, launchDate: string | null = getConfiguredLaunchDate()) {
  const counts = Object.fromEntries(PUZZLE_STATUSES.map((status) => [status, puzzles.filter((puzzle) => puzzle.status === status).length])) as Record<PuzzleStatus, number>;
  const scheduled = getScheduledPuzzles(puzzles); const approvedCount = counts.approved + counts.scheduled + counts.published;
  const unpublishedReserve = counts.approved + counts.scheduled; const lastPosition = scheduled.at(-1)?.schedulePosition ?? 0;
  const lastScheduledPuzzleDate = launchDate && lastPosition ? new Date((utcDay(launchDate) + lastPosition - 1) * 86_400_000).toISOString().slice(0, 10) : null;
  return { approvedCount, scheduledCount: counts.scheduled + counts.published, publishedCount: counts.published, unpublishedReserve,
    candidatesAwaitingReview: counts.candidate + counts["under-review"], rejectedCount: counts.rejected, quarantinedCount: counts.quarantined,
    daysRemainingBeforeExhaustion: unpublishedReserve, lastScheduledPuzzleDate, reserveWarning: unpublishedReserve < 30,
    launchReady: approvedCount >= 100 && scheduled.length >= 100 && validateDailyPuzzleRegistry(puzzles).length === 0 && Boolean(launchDate) };
}
