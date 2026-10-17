import {
  getConfiguredLaunchDate,
  getScheduledPuzzles,
  isPuzzleEditoriallyRevealed,
} from "./daily-puzzles.ts";

export type SurprisePair = {
  id: string;
  from: { id: string; label: string };
  to: { id: string; label: string };
  hook: string;
};

export const SURPRISE_PAIRS: readonly SurprisePair[] = [
  {
    id: "kevin-bacon-paw-patrol",
    from: { id: "Q3454165", label: "Kevin Bacon" },
    to: { id: "Q15106029", label: "Paw Patrol" },
    hook: "A movie career meets a kids' rescue team.",
  },
  {
    id: "george-lucas-steve-jobs",
    from: { id: "Q38222", label: "George Lucas" },
    to: { id: "Q19837", label: "Steve Jobs" },
    hook: "Two technology-shaped storytellers share a studio thread.",
  },
  {
    id: "statue-of-liberty-france",
    from: { id: "Q9202", label: "Statue of Liberty" },
    to: { id: "Q142", label: "France" },
    hook: "An American landmark with a French origin story.",
  },
  {
    id: "nasa-eisenhower",
    from: { id: "Q23548", label: "NASA" },
    to: { id: "Q9916", label: "Dwight D. Eisenhower" },
    hook: "A space agency traces back to a president.",
  },
  {
    id: "heroes-android",
    from: { id: "Q220965", label: "Heroes of Might and Magic III" },
    to: { id: "Q94", label: "Android" },
    hook: "A classic strategy game reaches a modern mobile platform.",
  },
  {
    id: "freebase-google",
    from: { id: "Q15241312", label: "Freebase Data Dumps" },
    to: { id: "Q95", label: "Google" },
    hook: "Open knowledge data meets the company that published it.",
  },
] as const;

function normalizedDisclosureText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unorderedPair(left: string, right: string): string {
  return [left.trim().toUpperCase(), right.trim().toUpperCase()].sort().join(":");
}

export function getSpoilerSafeSurprisePairs(
  now = new Date(),
  launchDate: string | null = getConfiguredLaunchDate(),
): SurprisePair[] {
  const futurePuzzles = getScheduledPuzzles().filter(
    (puzzle) => !isPuzzleEditoriallyRevealed(puzzle, now, launchDate),
  );

  return SURPRISE_PAIRS.filter((pair) => {
    const pairQids = new Set([pair.from.id, pair.to.id]);
    const pairKey = unorderedPair(pair.from.id, pair.to.id);
    const copy = ` ${normalizedDisclosureText(
      `${pair.from.label} ${pair.to.label} ${pair.hook}`,
    )} `;

    return !futurePuzzles.some((puzzle) => {
      const hidden = puzzle.path[puzzle.hiddenNodeIndex];
      if (hidden && pairQids.has(hidden.qid)) return true;
      if (
        hidden &&
        (` ${copy} `).includes(` ${normalizedDisclosureText(hidden.name)} `)
      ) {
        return true;
      }
      return puzzle.path.some((node, index) => {
        const next = puzzle.path[index + 1];
        return next && unorderedPair(node.qid, next.qid) === pairKey;
      });
    });
  });
}

export function pickSurprisePair(
  currentId: string | null,
  recentIds: readonly string[],
  randomValue: number,
): SurprisePair {
  const available = SURPRISE_PAIRS.filter(
    ({ id }) => id !== currentId && !recentIds.includes(id),
  );
  const pool = available.length > 0
    ? available
    : SURPRISE_PAIRS.filter(({ id }) => id !== currentId);
  const index = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(randomValue * pool.length)),
  );
  return pool[index] ?? SURPRISE_PAIRS[0];
}
