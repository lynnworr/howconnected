export const DISCOVERY_FAILURE_CATEGORIES = [
  "none",
  "no_strong_path",
  "semantic_quality_rejection",
  "timeout_or_budget",
  "upstream_wikidata",
  "neo4j_unavailable",
  "entity_not_found",
  "discovery_service",
] as const;

export type DiscoveryFailureCategory =
  (typeof DISCOVERY_FAILURE_CATEGORIES)[number];

type FailureDiagnosticInput = {
  found?: boolean;
  timedOut?: boolean;
  terminationReason?: string;
  bestRejectedPath?: unknown;
};

export function isDiscoveryFailureCategory(
  value: unknown,
): value is DiscoveryFailureCategory {
  return (
    typeof value === "string" &&
    (DISCOVERY_FAILURE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function classifyDiscoveryFailure(
  input: FailureDiagnosticInput,
): DiscoveryFailureCategory {
  if (input.found) return "none";

  const reason = input.terminationReason?.toLowerCase() ?? "";
  if (
    input.timedOut ||
    reason.includes("timeout") ||
    reason.includes("deadline") ||
    reason.includes("budget") ||
    reason.includes("limit-reached")
  ) {
    return "timeout_or_budget";
  }
  if (reason.includes("wikidata") || reason.includes("wikimedia")) {
    return "upstream_wikidata";
  }
  if (input.bestRejectedPath) return "semantic_quality_rejection";
  return "no_strong_path";
}
