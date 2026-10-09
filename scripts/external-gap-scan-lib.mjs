import { createHash } from "node:crypto";

const complexityWeight = { low: 1, medium: 2, high: 3 };
const supportOrder = { unsupported: 0, "partially-supported": 1, supported: 2 };
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function qid(value) {
  const match = String(value ?? "").match(/\/entity\/(Q[1-9][0-9]*)$/);
  return match?.[1] ?? (/^Q[1-9][0-9]*$/.test(String(value ?? "")) ? String(value) : null);
}

function literal(binding, key, fallback) {
  const value = binding?.[key]?.value;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function externalPairKey(sourceQid, targetQid) {
  return [sourceQid, targetQid].sort().join(":");
}

export function buildExternalCandidates(config, bindings) {
  const seen = new Set();
  const candidates = [];
  for (const binding of bindings) {
    const sourceQid = qid(binding?.source?.value);
    const targetQid = qid(binding?.target?.value);
    if (!sourceQid || !targetQid || sourceQid === targetQid) continue;
    const key = externalPairKey(sourceQid, targetQid);
    if (seen.has(key)) continue;
    seen.add(key);
    const sourceName = literal(binding, "sourceLabel", sourceQid);
    const targetName = literal(binding, "targetLabel", targetQid);
    const sourceDomain = config.sourceDomains[0] ?? "entity";
    const targetDomain = config.targetDomains[0] ?? "entity";
    candidates.push({
      id: createHash("sha1").update(`external:${config.id}:${sourceQid}:${targetQid}`).digest("hex").slice(0, 16),
      relationshipFamily: config.family,
      relationshipFamilyLabel: config.family,
      wikidataProperty: config.id,
      expectedRelationship: config.label,
      supportStatus: config.supportStatus,
      source: { qid: sourceQid, name: sourceName, description: literal(binding, "sourceDescription", ""), type: sourceDomain },
      target: { qid: targetQid, name: targetName, description: literal(binding, "targetDescription", ""), type: targetDomain },
      expectedSourceDomains: config.sourceDomains,
      expectedTargetDomains: config.targetDomains,
      relevance: config.relevance,
      complexity: config.complexity,
      hubRisk: config.hubRisk,
      likelyCodeArea: config.likelyCodeArea,
      sourceSitelinks: Number(binding?.sourceSitelinks?.value ?? 0) || 0,
      targetSitelinks: Number(binding?.targetSitelinks?.value ?? 0) || 0,
    });
  }
  return candidates.sort((left, right) =>
    (right.sourceSitelinks + right.targetSitelinks) - (left.sourceSitelinks + left.targetSitelinks) || left.id.localeCompare(right.id));
}

export function selectBalancedExternalCorpus(candidates, sampleSize) {
  const groups = new Map();
  for (const candidate of candidates) {
    const queue = groups.get(candidate.wikidataProperty) ?? [];
    queue.push(candidate);
    groups.set(candidate.wikidataProperty, queue);
  }
  const queues = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  const selected = [];
  const pairs = new Set();
  let cursor = 0;
  while (selected.length < sampleSize && queues.some(([, queue]) => queue.length > 0)) {
    const [, queue] = queues[cursor % queues.length];
    cursor += 1;
    const candidate = queue.shift();
    if (!candidate) continue;
    const key = externalPairKey(candidate.source.qid, candidate.target.qid);
    if (pairs.has(key)) continue;
    pairs.add(key);
    selected.push(candidate);
  }
  return selected;
}

export function selectExternalDevelopmentCorpus(pairs, sampleSize = 100) {
  const groups = new Map();
  for (const pair of [...pairs].sort((left, right) => left.id.localeCompare(right.id))) {
    const queue = groups.get(pair.wikidataProperty) ?? [];
    queue.push(pair);
    groups.set(pair.wikidataProperty, queue);
  }
  const queues = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  const selected = [];
  let cursor = 0;
  while (selected.length < Math.min(sampleSize, pairs.length) && queues.some(([, queue]) => queue.length > 0)) {
    const [, queue] = queues[cursor % queues.length];
    cursor += 1;
    const pair = queue.shift();
    if (pair) selected.push(pair);
  }
  return selected;
}

function rejectedPenalty(diagnostics) {
  const rejected = diagnostics?.bestRejectedPath;
  return Number(rejected?.patternPenalty ?? rejected?.scoreBreakdown?.patternPenalty ?? 0) || 0;
}

export function diagnoseExternalFailure(pair, result, evidence) {
  if (result.found) return [];
  const causes = [];
  const diagnostics = result.diagnostics ?? {};
  const termination = String(diagnostics.terminationReason ?? result.terminationReason ?? "").toLowerCase();
  const property = pair.wikidataProperty;
  if (pair.supportStatus === "unsupported" || !evidence.enabledProperties.includes(property)) causes.push("unsupported property");
  if (pair.supportStatus !== "unsupported" && !evidence.reverseEnabledProperties.includes(property)) causes.push("reverse traversal missing");
  if (pair.supportStatus !== "unsupported" && !evidence.sourceSelectedProperties.includes(property)) causes.push("source-domain property selection missing");
  if (pair.supportStatus !== "unsupported" && evidence.reverseEnabledProperties.includes(property) && !evidence.targetReverseSelectedProperties.includes(property)) causes.push("target-domain property selection missing");
  // Domain expectations are corpus-balancing heuristics, not proof that an
  // unusual but valid Wikidata statement is misclassified. Treat only the
  // classifier's generic fallback as concrete misclassification evidence.
  if (evidence.sourceDomain === "entity" && !pair.expectedSourceDomains.includes("entity")) causes.push("source misclassification");
  if (evidence.targetDomain === "entity" && !pair.expectedTargetDomains.includes("entity")) causes.push("target misclassification");
  if (evidence.sourcePresent === false || evidence.targetPresent === false || (pair.supportStatus !== "unsupported" && evidence.relationshipPresent === false)) causes.push("ingestion missing");
  const expansionFanout = [
    ...(diagnostics.expandedBySide?.source ?? []),
    ...(diagnostics.expandedBySide?.target ?? []),
  ].some((expansion) => Number(expansion.relationshipsDiscovered ?? 0) > Number(expansion.relationshipsAdded ?? 0));
  if (termination.includes("fanout") || diagnostics.fanoutBlocked === true || (evidence.relationshipPresent === false && expansionFanout)) causes.push("fanout excluded target");
  const budgetReached = Object.values(diagnostics.limits ?? {}).some((limit) => Number(limit?.used ?? 0) >= Number(limit?.limit ?? Number.POSITIVE_INFINITY));
  if (termination.includes("budget") || termination.includes("depth") || diagnostics.budgetExhausted === true || budgetReached) causes.push("depth/budget issue");
  if (diagnostics.timedOut === true || termination.includes("timeout") || termination.includes("time-budget")) causes.push("timeout");
  if (diagnostics.bestRejectedPath) causes.push("path exists but scoring rejected");
  if (rejectedPenalty(diagnostics) > 0) causes.push("path-pattern penalty rejected");
  if ((result.httpStatus ?? 0) >= 500 || termination.includes("upstream") || termination.includes("wikidata")) causes.push("upstream failure");
  if (causes.length === 0) causes.push("depth/budget issue");
  return [...new Set(causes)];
}

export function isRetryableExternalResult(result) {
  if (!result || result.found) return false;
  if (Number(result.runtimeMs ?? 0) >= 60_000) return true;
  const reason = String(result.terminationReason ?? "").toLowerCase();
  return (result.httpStatus ?? 0) >= 500 || ["wikidata", "upstream", "fetch failed", "request failed", "econnrefused", "socket"].some((term) => reason.includes(term));
}

const FAILURE_PRIORITY = [
  "upstream failure",
  "unsupported property",
  "source misclassification",
  "target misclassification",
  "source-domain property selection missing",
  "target-domain property selection missing",
  "ingestion missing",
  "fanout excluded target",
  "timeout",
  "path-pattern penalty rejected",
  "path exists but scoring rejected",
  "depth/budget issue",
  "reverse traversal missing",
];

export function primaryExternalFailureCause(causes) {
  return FAILURE_PRIORITY.find((cause) => causes.includes(cause)) ?? causes[0] ?? null;
}

function aggregateBy(results, keyName) {
  const groups = new Map();
  for (const result of results) {
    const key = result[keyName];
    const group = groups.get(key) ?? { key, attempted: 0, tested: 0, found: 0, falseNegatives: 0, runtimeTotal: 0, causes: new Map(), properties: new Set() };
    group.attempted += 1;
    group.properties.add(result.wikidataProperty);
    if (result.inconclusive) {
      groups.set(key, group);
      continue;
    }
    group.tested += 1;
    group.runtimeTotal += result.runtimeMs ?? 0;
    if (result.found) group.found += 1;
    else {
      group.falseNegatives += 1;
      const cause = result.primaryFailureCause ?? primaryExternalFailureCause(result.failureCauses ?? []);
      if (cause) group.causes.set(cause, (group.causes.get(cause) ?? 0) + 1);
    }
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const dominantFailureCause = [...group.causes.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
    return {
      [keyName]: group.key,
      properties: [...group.properties].sort(),
      attempted: group.attempted,
      tested: group.tested,
      found: group.found,
      falseNegatives: group.falseNegatives,
      falseNegativeRate: group.tested === 0 ? 0 : group.falseNegatives / group.tested,
      averageRuntimeMs: group.tested === 0 ? 0 : Math.round(group.runtimeTotal / group.tested),
      dominantFailureCause,
    };
  }).sort((left, right) => right.falseNegativeRate - left.falseNegativeRate || right.falseNegatives - left.falseNegatives || String(left[keyName]).localeCompare(String(right[keyName])));
}

function recommendationFor(propertyCoverage, config, results) {
  const failures = results.filter((result) => result.wikidataProperty === config.id && result.falseNegative);
  const domains = new Set(failures.flatMap((result) => [result.sourceDomain, result.targetDomain]));
  const productionFrequency = failures.reduce((sum, result) => sum + (result.productionAttemptFrequency ?? 0), 0);
  const complexityPenalty = (complexityWeight[config.complexity] ?? 2) * 6;
  const supportBonus = config.supportStatus === "unsupported" ? 15 : config.supportStatus === "partially-supported" ? 8 : 0;
  const priorityScore = Math.round((propertyCoverage.falseNegatives * 3 + propertyCoverage.falseNegativeRate * 35 + domains.size * 3 + config.relevance * 5 + Math.log2(1 + productionFrequency) * 2 + supportBonus - complexityPenalty) * 10) / 10;
  return {
    property: config.id,
    propertyLabel: config.label,
    relationshipFamily: config.family,
    supportStatus: config.supportStatus,
    rootCause: propertyCoverage.dominantFailureCause,
    falseNegatives: propertyCoverage.falseNegatives,
    tested: propertyCoverage.tested,
    falseNegativeRate: propertyCoverage.falseNegativeRate,
    affectedDomains: [...domains].filter(Boolean).sort(),
    productionAttemptFrequency: productionFrequency,
    complexity: config.complexity,
    likelyCodeArea: config.likelyCodeArea,
    expectedCoverageGain: propertyCoverage.falseNegatives,
    hubPollutionRisk: config.hubRisk,
    priorityScore,
    representativeFailures: failures.slice(0, 4).map((result) => ({ sourceQid: result.sourceQid, sourceName: result.sourceName, targetQid: result.targetQid, targetName: result.targetName })),
  };
}

export function buildExternalReportSections(results, configs) {
  const propertyCoverage = aggregateBy(results, "wikidataProperty").map((coverage) => {
    const config = configs.find(({ id }) => id === coverage.wikidataProperty);
    return { ...coverage, propertyLabel: config?.label ?? coverage.wikidataProperty, relationshipFamily: config?.family ?? "unknown", supportStatus: config?.supportStatus ?? "unknown" };
  });
  const familyCoverage = aggregateBy(results, "relationshipFamily");
  const unsupportedProperties = configs.filter(({ supportStatus }) => supportStatus === "unsupported").flatMap((config) => {
    const tested = results.filter((result) => result.wikidataProperty === config.id);
    if (tested.length === 0) return [];
    const conclusive = tested.filter((result) => !result.inconclusive);
    const falseNegatives = conclusive.filter((result) => result.falseNegative).length;
    return [{
      property: config.id,
      propertyLabel: config.label,
      samplePairCount: tested.length,
      conclusivePairCount: conclusive.length,
      sampleFailureRate: conclusive.length === 0 ? null : falseNegatives / conclusive.length,
      representativeExamples: tested.slice(0, 4).map((result) => ({ sourceQid: result.sourceQid, sourceName: result.sourceName, targetQid: result.targetQid, targetName: result.targetName })),
      likelySourceDomains: config.sourceDomains,
      likelyTargetDomains: config.targetDomains,
      implementationComplexity: config.complexity,
    }];
  });
  const recommendations = propertyCoverage
    .filter(({ falseNegatives }) => falseNegatives > 0)
    .map((coverage) => recommendationFor(coverage, configs.find(({ id }) => id === coverage.wikidataProperty), results))
    .sort((left, right) => right.priorityScore - left.priorityScore || right.falseNegatives - left.falseNegatives)
    .slice(0, 20)
    .map((item, index) => ({ rank: index + 1, ...item }));
  return { propertyCoverage, familyCoverage, unsupportedProperties, recommendations };
}

export function compareExternalReports(before, after) {
  const beforeResults = new Map(before.results.map((result) => [result.pairId, result]));
  const afterResults = new Map(after.results.map((result) => [result.pairId, result]));
  const falseNegativesFixed = [];
  const newFalseNegatives = [];
  for (const [id, current] of afterResults) {
    const previous = beforeResults.get(id);
    if (!previous) continue;
    if (previous.falseNegative && !current.falseNegative) falseNegativesFixed.push(id);
    if (!previous.falseNegative && current.falseNegative) newFalseNegatives.push(id);
  }
  const rates = (report) => new Map((report.propertyCoverage ?? []).map((item) => [item.wikidataProperty, item.falseNegativeRate]));
  const beforeRates = rates(before);
  const afterRates = rates(after);
  const changes = [...new Set([...beforeRates.keys(), ...afterRates.keys()])].map((property) => ({ property, beforeRate: beforeRates.get(property) ?? 0, afterRate: afterRates.get(property) ?? 0 }));
  return {
    beforeRunId: before.runId,
    afterRunId: after.runId,
    overallCoverageChange: (1 - after.summary.falseNegativeRate) - (1 - before.summary.falseNegativeRate),
    medianRuntimeChangeMs: (after.summary.medianRuntimeMs ?? 0) - (before.summary.medianRuntimeMs ?? 0),
    p95RuntimeChangeMs: (after.summary.p95RuntimeMs ?? 0) - (before.summary.p95RuntimeMs ?? 0),
    timeoutRateChange: (after.summary.timeoutRate ?? 0) - (before.summary.timeoutRate ?? 0),
    suspiciousPathCountChange: (after.summary.suspiciousPathCount ?? 0) - (before.summary.suspiciousPathCount ?? 0),
    falseNegativesFixed,
    newFalseNegatives,
    propertiesImproved: changes.filter((item) => item.afterRate < item.beforeRate).sort((a, b) => (b.beforeRate - b.afterRate) - (a.beforeRate - a.afterRate)),
    propertiesRegressed: changes.filter((item) => item.afterRate > item.beforeRate).sort((a, b) => (b.afterRate - b.beforeRate) - (a.afterRate - a.beforeRate)),
  };
}

export function externalResultsToCsv(results) {
  const columns = ["pairId", "wikidataProperty", "expectedRelationship", "relationshipFamily", "supportStatus", "sourceQid", "sourceName", "sourceDomain", "targetQid", "targetName", "targetDomain", "found", "falseNegative", "inconclusive", "returnedPath", "returnedRelationships", "qualityBand", "score", "suspicious", "suspiciousPatterns", "runtimeMs", "stage", "terminationReason", "primaryFailureCause", "failureCauses"];
  return `${columns.join(",")}\n${results.map((result) => columns.map((column) => csvCell(Array.isArray(result[column]) ? result[column].join(" | ") : result[column])).join(",")).join("\n")}\n`;
}

export function supportStatusCounts(configs) {
  return [...configs].sort((left, right) => supportOrder[left.supportStatus] - supportOrder[right.supportStatus]).reduce((counts, config) => ({ ...counts, [config.supportStatus]: (counts[config.supportStatus] ?? 0) + 1 }), {});
}
