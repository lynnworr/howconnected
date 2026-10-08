import "server-only";

import type { PathFeedback } from "@/lib/path-feedback";
import { getNeo4jDriver } from "@/lib/neo4j";

export async function storePathFeedback(feedback: PathFeedback): Promise<void> {
  await getNeo4jDriver().executeQuery(
    `
      CREATE (:PathFeedback {
        id: randomUUID(),
        fromQid: $fromQid,
        toQid: $toQid,
        rating: $rating,
        reason: $reason,
        pathSteps: $pathSteps,
        timestamp: datetime()
      })
    `,
    {
      ...feedback,
      reason: feedback.reason ?? "",
    },
  );
}
