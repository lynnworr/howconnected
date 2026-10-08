import { isValidQid } from "./wikidata-id.ts";

export const PATH_FEEDBACK_RATINGS = ["yes", "not_really"] as const;
export const PATH_FEEDBACK_REASONS = [
  "too_generic",
  "technically_true_but_boring",
  "relationship_feels_weak",
  "incorrect",
  "better_path_exists",
] as const;

export type PathFeedbackRating = (typeof PATH_FEEDBACK_RATINGS)[number];
export type PathFeedbackReason = (typeof PATH_FEEDBACK_REASONS)[number];

export type PathFeedback = {
  fromQid: string;
  toQid: string;
  rating: PathFeedbackRating;
  reason: PathFeedbackReason | null;
  pathSteps: number;
};

type FeedbackStore = (feedback: PathFeedback) => Promise<void>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePathFeedback(value: unknown): PathFeedback | null {
  if (!isRecord(value)) return null;

  const allowedKeys = new Set([
    "fromQid",
    "toQid",
    "rating",
    "reason",
    "pathSteps",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;

  const fromQid =
    typeof value.fromQid === "string" ? value.fromQid.trim().toUpperCase() : "";
  const toQid =
    typeof value.toQid === "string" ? value.toQid.trim().toUpperCase() : "";
  const rating = value.rating;
  const reason = value.reason ?? null;
  const pathSteps = value.pathSteps;

  if (!isValidQid(fromQid) || !isValidQid(toQid) || fromQid === toQid) {
    return null;
  }
  if (!PATH_FEEDBACK_RATINGS.includes(rating as PathFeedbackRating)) return null;
  if (
    reason !== null &&
    !PATH_FEEDBACK_REASONS.includes(reason as PathFeedbackReason)
  ) {
    return null;
  }
  if (
    typeof pathSteps !== "number" ||
    !Number.isInteger(pathSteps) ||
    pathSteps < 1 ||
    pathSteps > 5
  ) {
    return null;
  }
  if (rating === "yes" && reason !== null) return null;

  return {
    fromQid,
    toQid,
    rating: rating as PathFeedbackRating,
    reason: reason as PathFeedbackReason | null,
    pathSteps,
  };
}

export async function handlePathFeedbackRequest(
  request: Request,
  store: FeedbackStore,
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    return Response.json({ error: "Feedback request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Feedback must be valid JSON." }, { status: 400 });
  }

  const feedback = validatePathFeedback(body);
  if (!feedback) {
    return Response.json(
      { error: "Feedback fields are invalid." },
      { status: 400 },
    );
  }

  await store(feedback);
  return Response.json({ success: true }, { status: 201 });
}
