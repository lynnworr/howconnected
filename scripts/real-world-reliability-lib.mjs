import {
  classifySemanticQuality,
  detectSuspiciousPatterns,
} from "./domain-benchmark-lib.mjs";

const TECHNICAL_FAILURES = new Set([
  "timeout_or_budget",
  "upstream_wikidata",
  "neo4j_unavailable",
  "entity_not_found",
  "discovery_service",
]);

const average = (values) =>
  values.length === 0
    ? null
    : Math.round(values.reduce((total, value) => total + value, 0) / values.length);

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
};

export function classifyAttempt(pair, response) {
  const path = response.pathDetails ?? null;
  const suspiciousPatterns = detectSuspiciousPatterns(path);
  const semanticQuality = classifySemanticQuality({
    found: response.found,
    path,
    suspiciousPatterns,
  });
  const failureCategory = response.failureCategory ?? (
    response.found
      ? "none"
      : response.timedOut
        ? "timeout_or_budget"
        : response.bestRejectedPath
          ? "semantic_quality_rejection"
          : response.httpStatus === 502
            ? "upstream_wikidata"
            : response.httpStatus === 503
              ? "discovery_service"
              : "no_strong_path"
  );
  const meaningful = response.found && semanticQuality === "good";
  const technicalFailure = TECHNICAL_FAILURES.has(failureCategory);
  const legitimateNoPath =
    !response.found &&
    !technicalFailure &&
    pair.expectation === "no-strong-path";

  let discoveryOutcome = "coverage_gap";
  if (meaningful) discoveryOutcome = "meaningful_path";
  else if (response.found) discoveryOutcome = "questionable_path";
  else if (technicalFailure) discoveryOutcome = "technical_failure";
  else if (legitimateNoPath) discoveryOutcome = "legitimate_no_path";
  else if (failureCategory === "semantic_quality_rejection") {
    discoveryOutcome = "quality_rejection";
  }

  const rootExpansions = [
    ...(response.diagnostics?.expandedBySide?.source ?? []),
    ...(response.diagnostics?.expandedBySide?.target ?? []),
  ].filter(({ depth }) => depth === 0);
  const targetAwareRecovery =
    response.found &&
    response.stage === "B" &&
    response.pathLength === 1 &&
    rootExpansions.some(
      ({ alreadyExpanded, relationshipsAdded }) =>
        alreadyExpanded === true && Number(relationshipsAdded) > 0,
    );

  return {
    ...response,
    suspiciousPatterns,
    suspicious: suspiciousPatterns.length > 0,
    semanticQuality,
    meaningful,
    failureCategory,
    technicalFailure,
    legitimateNoPath,
    discoveryOutcome,
    discoveryMode:
      response.stage === "A"
        ? "warm"
        : response.stage === "B" || response.stage === "C"
          ? "cold"
          : "unresolved",
    recoveryKind: targetAwareRecovery
      ? "target-aware-fanout"
      : response.found && response.stage === "B"
        ? "missing-ingestion"
        : response.found && response.stage === "C"
          ? "assisted-candidate"
          : null,
  };
}

export function compareAttempts(first, retry) {
  return {
    resultChanged:
      first.found !== retry.found ||
      first.discoveryOutcome !== retry.discoveryOutcome ||
      first.pathQids.join(">") !== retry.pathQids.join(">"),
    retryRecovered: !first.meaningful && retry.meaningful,
    firstMode: first.discoveryMode,
    retryMode: retry.discoveryMode,
    firstRuntimeMs: first.runtimeMs,
    retryRuntimeMs: retry.runtimeMs,
    runtimeDeltaMs: retry.runtimeMs - first.runtimeMs,
  };
}

export function summarizeReliability(results) {
  const firstAttempts = results.map(({ first }) => first);
  const retries = results.map(({ retry }) => retry);
  const cold = firstAttempts.filter(({ discoveryMode }) => discoveryMode === "cold");
  const warm = firstAttempts.filter(({ discoveryMode }) => discoveryMode === "warm");
  const count = (values, predicate) => values.filter(predicate).length;
  const rate = (value) => value / Math.max(1, results.length);

  return {
    totalPairs: results.length,
    successRate: rate(count(firstAttempts, ({ found }) => found)),
    meaningfulPathRate: rate(count(firstAttempts, ({ meaningful }) => meaningful)),
    retryRecoveryRate: rate(count(results, ({ comparison }) => comparison.retryRecovered)),
    resultChangeRate: rate(count(results, ({ comparison }) => comparison.resultChanged)),
    technicalFailureRate: rate(count(firstAttempts, ({ technicalFailure }) => technicalFailure)),
    legitimateNoPathRate: rate(count(firstAttempts, ({ legitimateNoPath }) => legitimateNoPath)),
    qualityRejectionRate: rate(count(firstAttempts, ({ discoveryOutcome }) => discoveryOutcome === "quality_rejection")),
    cold: {
      pairs: cold.length,
      averageMs: average(cold.map(({ runtimeMs }) => runtimeMs)),
      medianMs: median(cold.map(({ runtimeMs }) => runtimeMs)),
    },
    warm: {
      pairs: warm.length,
      averageMs: average(warm.map(({ runtimeMs }) => runtimeMs)),
      medianMs: median(warm.map(({ runtimeMs }) => runtimeMs)),
    },
    retries: {
      averageMs: average(retries.map(({ runtimeMs }) => runtimeMs)),
      medianMs: median(retries.map(({ runtimeMs }) => runtimeMs)),
    },
    failureCategories: Object.fromEntries(
      [...new Set(firstAttempts.map(({ failureCategory }) => failureCategory))]
        .map((category) => [
          category,
          count(firstAttempts, ({ failureCategory }) => failureCategory === category),
        ])
        .sort((left, right) => right[1] - left[1]),
    ),
    recoveryKinds: Object.fromEntries(
      [...new Set(firstAttempts.map(({ recoveryKind }) => recoveryKind).filter(Boolean))]
        .map((kind) => [kind, count(firstAttempts, ({ recoveryKind }) => recoveryKind === kind)]),
    ),
  };
}

export function reliabilityResultsToCsv(results) {
  const columns = [
    "id", "category", "sourceLabel", "sourceQid", "targetLabel", "targetQid",
    "expectation", "found", "meaningful", "semanticQuality", "pathLength",
    "qualityBand", "stage", "discoveryMode", "runtimeMs", "failureCategory",
    "discoveryOutcome", "recoveryKind", "retryFound", "retryMeaningful",
    "retryStage", "retryRuntimeMs", "resultChanged", "retryRecovered", "path",
  ];
  const csvCell = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows = results.map(({ pair, first, retry, comparison }) => ({
    ...pair,
    found: first.found,
    meaningful: first.meaningful,
    semanticQuality: first.semanticQuality,
    pathLength: first.pathLength,
    qualityBand: first.qualityBand,
    stage: first.stage,
    discoveryMode: first.discoveryMode,
    runtimeMs: first.runtimeMs,
    failureCategory: first.failureCategory,
    discoveryOutcome: first.discoveryOutcome,
    recoveryKind: first.recoveryKind,
    retryFound: retry.found,
    retryMeaningful: retry.meaningful,
    retryStage: retry.stage,
    retryRuntimeMs: retry.runtimeMs,
    resultChanged: comparison.resultChanged,
    retryRecovered: comparison.retryRecovered,
    path: first.pathNames.join(" -> "),
  }));
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}
