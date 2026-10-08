export function getConnectionPath(fromQid: string, toQid: string): string {
  return `/connect/${encodeURIComponent(fromQid)}/${encodeURIComponent(toQid)}`;
}

export function getConnectionSentence(
  sourceName: string,
  targetName: string,
  steps: number,
): string {
  return `${sourceName} is connected to ${targetName} in ${steps} ${
    steps === 1 ? "step" : "steps"
  }.`;
}

export function getConnectionShareText(
  sourceName: string,
  targetName: string,
  steps: number,
  url: string,
): string {
  return `${getConnectionSentence(sourceName, targetName, steps)}\n\n${url}`;
}

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

export type ShareEnvironment = {
  share?: (payload: SharePayload) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

export type ShareOutcome = "shared" | "copied" | "cancelled" | "unavailable";

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function shareConnection(
  sourceName: string,
  targetName: string,
  steps: number,
  url: string,
  environment: ShareEnvironment,
): Promise<ShareOutcome> {
  const sentence = getConnectionSentence(sourceName, targetName, steps);

  if (environment.share) {
    try {
      await environment.share({ title: "HowConnected", text: sentence, url });
      return "shared";
    } catch (error: unknown) {
      if (isAbortError(error)) return "cancelled";
    }
  }

  if (!environment.writeText) return "unavailable";

  await environment.writeText(
    getConnectionShareText(sourceName, targetName, steps, url),
  );
  return "copied";
}
