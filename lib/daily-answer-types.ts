import type { ConnectionRecommendation } from "./connection-recommendations.ts";
import type {
  MissingLinkPuzzle,
  PuzzleCategory,
  PuzzleNode,
  PuzzleRelationship,
} from "./daily-puzzles.ts";

export type PublicDailyPuzzle = {
  id: string;
  title: string;
  prompt: string;
  category: PuzzleCategory;
  hiddenNodeIndex: number;
  path: readonly {
    slotId: string;
    hidden: boolean;
    qid?: string;
    name?: string;
  }[];
  options: readonly { id: string; label: string }[];
};

export type DailyAnswerReveal = {
  correct: boolean;
  selectedOptionId: string;
  path: readonly PuzzleNode[];
  relationships: readonly PuzzleRelationship[];
  explanation: string;
  recommendations: readonly ConnectionRecommendation[];
};

export function toPublicDailyPuzzle(puzzle: MissingLinkPuzzle): PublicDailyPuzzle {
  return {
    id: puzzle.id,
    title: puzzle.title,
    prompt: puzzle.prompt,
    category: puzzle.category,
    hiddenNodeIndex: puzzle.hiddenNodeIndex,
    path: puzzle.path.map((node, index) =>
      index === puzzle.hiddenNodeIndex
        ? { slotId: `hidden-${index}`, hidden: true }
        : {
            slotId: `node-${index}-${node.qid}`,
            hidden: false,
            qid: node.qid,
            name: node.name,
          },
    ),
    options: puzzle.options.map(({ id, label }) => ({ id, label })),
  };
}
