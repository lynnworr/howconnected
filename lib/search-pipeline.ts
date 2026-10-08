export async function withOptionalSearchEnrichment<T>(
  primaryLookup: () => Promise<T[]>,
  optionalEnrichment?: (results: T[]) => Promise<T[]>,
): Promise<T[]> {
  const primaryResults = await primaryLookup();
  if (!optionalEnrichment) return primaryResults;

  try {
    const enriched = await optionalEnrichment(primaryResults);
    return enriched.length > 0 ? enriched : primaryResults;
  } catch {
    return primaryResults;
  }
}

export function createLatestRequestGuard() {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isCurrent(requestId: number) {
      return requestId === latestRequest;
    },
    invalidate() {
      latestRequest += 1;
    },
  };
}
