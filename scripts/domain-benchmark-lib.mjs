const INVESTMENT_NAMES = /\b(blackrock|vanguard|state street|fidelity investments|capital group|asset management|private equity)\b/i;
const BROAD_ORGANIZATIONS = /\b(united nations|european union|european economic area|world bank|international monetary fund|nato)\b/i;
const ASSOCIATION_NAMES = /\b(association|guild|trade union|federation|chamber of commerce)\b/i;
const EDUCATION_NAMES = /\b(university|college|school|academy)\b/i;
const OWNERSHIP_TYPES = new Set(["OWNED_BY", "PARENT_ORGANIZATION", "SUBSIDIARY", "ACQUIRED_BY"]);
const GEOGRAPHIC_TYPES = new Set(["COUNTRY", "LOCATION", "LOCATED_IN_ADMINISTRATIVE_ENTITY", "PART_OF"]);
const MEMBERSHIP_TYPES = new Set(["MEMBER_OF", "MEMBER_OF_POLITICAL_PARTY", "MEMBER_OF_SPORTS_TEAM"]);

function intermediateNames(path) {
  return (path?.nodes ?? []).slice(1, -1).map((node) => node.name ?? "");
}

export function detectSuspiciousPatterns(path) {
  if (!path) return [];
  const patterns = new Set();
  const names = intermediateNames(path);
  const relationships = path.relationships ?? [];
  const types = relationships.map((relationship) => relationship.storedType ?? "");

  if (names.some((name) => INVESTMENT_NAMES.test(name))) {
    patterns.add("investment-firm-bridge");
  }
  if (names.some((name) => BROAD_ORGANIZATIONS.test(name))) {
    patterns.add("extremely-broad-organization");
  }
  if (names.some((name) => ASSOCIATION_NAMES.test(name))) {
    patterns.add("association-bridge");
  }
  if (
    names.some((name) => EDUCATION_NAMES.test(name)) &&
    types.filter((type) => type === "EDUCATED_AT").length >= 2
  ) {
    patterns.add("school-unrelated-alumnus");
  }
  if (types.filter((type) => MEMBERSHIP_TYPES.has(type)).length >= 2) {
    patterns.add("repeated-membership");
  }
  if (types.filter((type) => OWNERSHIP_TYPES.has(type)).length >= 2) {
    patterns.add("generic-corporate-parent-chain");
  }
  if (types.filter((type) => GEOGRAPHIC_TYPES.has(type)).length >= 2) {
    patterns.add("generic-geographic-container");
  }

  for (let index = 0; index < relationships.length - 1; index += 1) {
    const current = relationships[index];
    const next = relationships[index + 1];
    if (
      current.storedType === "FOUNDED_BY" &&
      next.storedType === "FOUNDED_BY" &&
      current.direction === "reverse" &&
      next.direction === "forward" &&
      path.nodes?.[index]?.type === "place" &&
      path.nodes?.[index + 2]?.type === "place"
    ) {
      patterns.add("country-union-peer-country");
    }
    if (
      GEOGRAPHIC_TYPES.has(current.storedType) &&
      current.direction === "forward" &&
      next.storedType === "COUNTRY_OF_CITIZENSHIP" &&
      next.direction === "reverse"
    ) {
      patterns.add("country-unrelated-citizen");
    }
  }

  return [...patterns];
}

const BAD_PATTERNS = new Set([
  "investment-firm-bridge",
  "country-union-peer-country",
  "country-unrelated-citizen",
  "school-unrelated-alumnus",
  "association-bridge",
  "repeated-membership",
]);

export function classifySemanticQuality({ found, path, suspiciousPatterns }) {
  if (!found || !path) return "bad";
  if (suspiciousPatterns.some((pattern) => BAD_PATTERNS.has(pattern))) return "bad";
  if (
    suspiciousPatterns.length > 0 ||
    path.steps >= 5 ||
    (typeof path.score === "number" && path.score >= 7.5)
  ) {
    return "borderline";
  }
  return "good";
}

export function diagnoseFailure(result) {
  if (result.found) return [];
  if (result.httpStatus === 400 || result.httpStatus === 404) {
    return ["search/QID resolution issue"];
  }
  if (
    (result.httpStatus ?? 0) >= 500 &&
    /wikidata|wikimedia/i.test(result.terminationReason ?? "")
  ) {
    return ["upstream Wikidata failure"];
  }
  if ((result.httpStatus ?? 0) >= 500) return ["discovery service error"];
  const categories = new Set();
  if (result.timedOut) categories.add("discovery depth/budget issue");
  if (result.bestRejectedPath?.patternPenalty > 0) {
    categories.add("path-quality penalty rejection");
  }
  if (result.bestRejectedPath?.score > 8) {
    categories.add("score threshold rejection");
  }
  if (result.sourceType === "entity" || result.targetType === "entity") {
    categories.add("missing entity-domain classification");
    categories.add("missing Wikidata property family");
  }
  if ((result.depthReached ?? 0) >= 3) {
    categories.add("missing bridge relationship");
  }
  if (result.expandedEntities === 0) {
    categories.add("missing Wikidata property family");
  }
  if (categories.size === 0) {
    categories.add("weak contextual property selection");
  }
  return [...categories];
}

function rate(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function summarizeResults(results) {
  const total = results.length;
  const count = (predicate) => results.filter(predicate).length;
  const runtimes = results.map(({ runtimeMs }) => runtimeMs);
  return {
    totalPairs: total,
    successRate: rate(count(({ found }) => found), total),
    strongRate: rate(count(({ qualityBand }) => qualityBand === "strong"), total),
    acceptableRate: rate(count(({ qualityBand }) => qualityBand === "acceptable"), total),
    weakDisplayedRate: rate(count(({ qualityBand }) => qualityBand === "weak"), total),
    suspiciousPathRate: rate(count(({ suspicious }) => suspicious), total),
    semanticQualityRates: {
      good: rate(count(({ semanticQuality }) => semanticQuality === "good"), total),
      borderline: rate(count(({ semanticQuality }) => semanticQuality === "borderline"), total),
      bad: rate(count(({ semanticQuality }) => semanticQuality === "bad"), total),
    },
    timeoutRate: rate(count(({ timedOut }) => timedOut), total),
    averageRuntimeMs:
      total === 0
        ? 0
        : Math.round(runtimes.reduce((sum, runtime) => sum + runtime, 0) / total),
    medianRuntimeMs: median(runtimes),
  };
}

export function rankDomains(results) {
  const domains = [...new Set(results.map(({ domain }) => domain))];
  return domains
    .map((domain) => ({ domain, ...summarizeResults(results.filter((result) => result.domain === domain)) }))
    .sort(
      (left, right) =>
        right.semanticQualityRates.good - left.semanticQualityRates.good ||
        right.successRate - left.successRate ||
        left.suspiciousPathRate - right.suspiciousPathRate ||
        left.averageRuntimeMs - right.averageRuntimeMs,
    );
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resultsToCsv(results) {
  const columns = [
    "domain", "sourceLabel", "sourceQid", "targetLabel", "targetQid", "found",
    "path", "qualityBand", "semanticQuality", "suspicious", "suspiciousPatterns",
    "stage", "runtimeMs", "terminationReason", "failureCategories",
  ];
  const rows = results.map((result) =>
    columns.map((column) => {
      if (column === "path") return csvCell(result.path.join(" -> "));
      if (column === "suspiciousPatterns") return csvCell(result.suspiciousPatterns.join(" | "));
      if (column === "failureCategories") return csvCell(result.failureCategories.join(" | "));
      return csvCell(result[column]);
    }).join(","),
  );
  return `${columns.join(",")}\n${rows.join("\n")}\n`;
}
