import "server-only";

import {
  getConfiguredLaunchDate,
  validateDailyAnswerSelection,
} from "./daily-puzzles.ts";
import {
  createConnectionRecommendationCatalog,
  selectDailyRecommendations,
} from "./connection-recommendations.ts";
import { getApprovedExploreConnections } from "./explore-connections.ts";
import type { DailyAnswerReveal } from "./daily-answer-types.ts";

export type DailyAnswerResult =
  | { status: "revealed"; reveal: DailyAnswerReveal }
  | { status: "invalid" | "unavailable" };

export function resolveDailyAnswer(input: {
  dateKey: string;
  puzzleId: string;
  selectedOptionId: string;
  now?: Date;
  launchDate?: string | null;
}): DailyAnswerResult {
  const now = input.now ?? new Date();
  const validation = validateDailyAnswerSelection({
    ...input,
    now,
    launchDate: input.launchDate === undefined ? getConfiguredLaunchDate() : input.launchDate,
  });
  if (validation.status !== "valid") return { status: validation.status };
  const puzzle = validation.puzzle;

  return {
    status: "revealed",
    reveal: {
      correct: validation.correct,
      selectedOptionId: input.selectedOptionId,
      path: puzzle.path,
      relationships: puzzle.relationships,
      explanation: puzzle.explanation,
      recommendations: selectDailyRecommendations(
        createConnectionRecommendationCatalog(getApprovedExploreConnections(now)),
        puzzle.path.map(({ qid }) => qid),
      ),
    },
  };
}
