import { track } from "@vercel/analytics/server";
import { handlePathFeedbackRequest } from "@/lib/path-feedback";
import { Neo4jConfigurationError } from "@/lib/neo4j";
import { storePathFeedback } from "@/lib/store-path-feedback";

export async function POST(request: Request) {
  try {
    return await handlePathFeedbackRequest(request, async (feedback) => {
      await storePathFeedback(feedback);
      try {
        await track(
          "path_feedback_submitted",
          {
            fromQid: feedback.fromQid,
            toQid: feedback.toQid,
            rating: feedback.rating,
            reason: feedback.reason ?? "none",
            steps: feedback.pathSteps,
          },
          { request: { headers: request.headers } },
        );
      } catch (error: unknown) {
        console.error("Feedback analytics failed", error);
      }
    });
  } catch (error: unknown) {
    if (error instanceof Neo4jConfigurationError) {
      return Response.json(
        { error: "Feedback storage is not configured." },
        { status: 503 },
      );
    }

    console.error("Path feedback submission failed", error);
    return Response.json(
      { error: "Could not save feedback." },
      { status: 503 },
    );
  }
}
