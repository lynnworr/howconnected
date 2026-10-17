import { resolveDailyAnswer } from "@/lib/daily-answer";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
} as const;
const MAX_REQUEST_LENGTH = 1_024;

export async function POST(request: Request) {
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > MAX_REQUEST_LENGTH) {
      return Response.json(
        { error: "A valid answer submission is required." },
        { status: rawBody.length > MAX_REQUEST_LENGTH ? 413 : 400, headers: RESPONSE_HEADERS },
      );
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { error: "A valid answer submission is required." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "A valid answer submission is required." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const input = body as Record<string, unknown>;
  const result = resolveDailyAnswer({
    dateKey: typeof input.dateKey === "string" ? input.dateKey : "",
    puzzleId: typeof input.puzzleId === "string" ? input.puzzleId : "",
    selectedOptionId:
      typeof input.selectedOptionId === "string" ? input.selectedOptionId : "",
  });

  if (result.status !== "revealed") {
    return Response.json(
      { error: "This daily answer cannot be revealed." },
      {
        status: result.status === "invalid" ? 400 : 404,
        headers: RESPONSE_HEADERS,
      },
    );
  }

  return Response.json(result.reveal, {
    headers: RESPONSE_HEADERS,
  });
}
