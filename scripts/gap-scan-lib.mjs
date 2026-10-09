import { createHash } from "node:crypto";

export const FAILURE_CAUSES = [
  "property not enabled",
  "reverse traversal not enabled",
  "property not selected for entity domain",
  "domain classification missing/wrong",
  "fanout cap blocked needed entity",
  "depth/budget limit",
  "timeout",
  "path exists in Neo4j but scoring rejected it",
  "path-pattern penalty rejected it",
  "upstream lookup failed",
  "entity missing from graph",
];

const text = (value) => typeof value === "string" ? value : "";
const domainMatches = (actual, expected) => expected.length === 0 || expected.includes(actual);

function patternMatches(node, pattern) {
  if (!pattern) return true;
  return new RegExp(pattern, "i").test(`${text(node.name)} ${text(node.description)}`);
}

function patternExcluded(node, pattern) {
  return Boolean(pattern) && new RegExp(pattern, "i").test(`${text(node.name)} ${text(node.description)}`);
}

export function pairKey(sourceQid, targetQid) {
  return `${sourceQid}:${targetQid}`;
}

export function undirectedPairKey(sourceQid, targetQid) {
  return [sourceQid, targetQid].sort().join(":");
}

function stableNumber(value) {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function edgeMatchesRule(edge, rule) {
  return edge.property === rule.property &&
    domainMatches(edge.source.type, rule.sourceDomains) &&
    domainMatches(edge.target.type, rule.targetDomains) &&
    patternMatches(edge.source, rule.sourcePattern) &&
    patternMatches(edge.target, rule.targetPattern) &&
    !patternExcluded(edge.source, rule.sourceExcludePattern) &&
    !patternExcluded(edge.target, rule.targetExcludePattern);
}

export function generateDirectCandidates(edges, families) {
  const candidates = [];
  for (const family of families) {
    for (const edge of edges) {
      if (edge.source.qid === edge.target.qid) continue;
      const rule = family.relationships.find((candidate) => edgeMatchesRule(edge, candidate));
      if (!rule) continue;
      const source = rule.queryDirection === "reverse" ? edge.target : edge.source;
      const target = rule.queryDirection === "reverse" ? edge.source : edge.target;
      candidates.push({
        id: createHash("sha1").update(`${family.id}:${pairKey(source.qid, target.qid)}:${edge.property}`).digest("hex").slice(0, 16),
        relationshipFamily: family.id,
        relationshipFamilyLabel: family.label,
        expectedProperties: [edge.property],
        expectedRelationshipTypes: [edge.relationshipType],
        expectedSteps: 1,
        expectedPath: [edge.source.qid, edge.target.qid],
        queryDirection: rule.queryDirection,
        source,
        target,
        relevance: family.relevance,
        complexity: family.complexity,
        likelyFix: family.likelyFix,
        notabilityScore: (source.attempts ?? 0) * 20 + (target.attempts ?? 0) * 20 + Math.log2(2 + (source.degree ?? 0) + (target.degree ?? 0)),
      });
    }
  }
  const seen = new Set();
  return candidates
    .sort((left, right) => right.notabilityScore - left.notabilityScore || stableNumber(left.id) - stableNumber(right.id))
    .filter((candidate) => {
      const key = `${candidate.relationshipFamily}:${undirectedPairKey(candidate.source.qid, candidate.target.qid)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function generateTwoHopCandidates(edges, templates) {
  const byNode = new Map();
  for (const edge of edges) {
    for (const side of ["source", "target"]) {
      const node = edge[side];
      const entries = byNode.get(node.qid) ?? [];
      entries.push({ edge, node, other: edge[side === "source" ? "target" : "source"] });
      byNode.set(node.qid, entries);
    }
  }

  const candidates = [];
  for (const template of templates) {
    const wanted = [...template.properties].sort().join(":");
    for (const [middleQid, entries] of byNode) {
      const bounded = entries.slice(0, 18);
      for (let leftIndex = 0; leftIndex < bounded.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < bounded.length; rightIndex += 1) {
          const left = bounded[leftIndex];
          const right = bounded[rightIndex];
          if (left.other.qid === right.other.qid) continue;
          if ([left.edge.property, right.edge.property].sort().join(":") !== wanted) continue;
          const endpoints = [left.other, right.other].sort((a, b) => a.qid.localeCompare(b.qid));
          candidates.push({
            id: createHash("sha1").update(`${template.id}:${endpoints[0].qid}:${endpoints[1].qid}:${middleQid}`).digest("hex").slice(0, 16),
            relationshipFamily: template.id,
            relationshipFamilyLabel: template.label,
            expectedProperties: [left.edge.property, right.edge.property],
            expectedRelationshipTypes: [left.edge.relationshipType, right.edge.relationshipType],
            expectedSteps: 2,
            expectedPath: [endpoints[0].qid, middleQid, endpoints[1].qid],
            queryDirection: "two-hop",
            source: endpoints[0],
            target: endpoints[1],
            relevance: template.relevance,
            complexity: "medium",
            likelyFix: "Inspect both property-selection policies and the two-hop depth/budget evidence.",
            notabilityScore: (endpoints[0].attempts ?? 0) * 20 + (endpoints[1].attempts ?? 0) * 20 + Math.log2(2 + (endpoints[0].degree ?? 0) + (endpoints[1].degree ?? 0)),
          });
        }
      }
    }
  }
  for (const [middleQid, entries] of byNode) {
    const bounded = entries.slice(0, 10);
    let addedForMiddle = 0;
    for (let leftIndex = 0; leftIndex < bounded.length && addedForMiddle < 6; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bounded.length && addedForMiddle < 6; rightIndex += 1) {
        const left = bounded[leftIndex];
        const right = bounded[rightIndex];
        if (left.other.qid === right.other.qid) continue;
        const endpoints = [left.other, right.other].sort((a, b) => a.qid.localeCompare(b.qid));
        const properties = [left.edge.property, right.edge.property];
        candidates.push({
          id: createHash("sha1").update(`semantic-two-hop:${endpoints[0].qid}:${endpoints[1].qid}:${middleQid}:${properties.join(":")}`).digest("hex").slice(0, 16),
          relationshipFamily: "semantic-two-hop",
          relationshipFamilyLabel: "explicit two-hop semantic bridge",
          expectedProperties: properties,
          expectedRelationshipTypes: [left.edge.relationshipType, right.edge.relationshipType],
          expectedSteps: 2,
          expectedPath: [endpoints[0].qid, middleQid, endpoints[1].qid],
          queryDirection: "two-hop",
          source: endpoints[0],
          target: endpoints[1],
          relevance: 2,
          complexity: "medium",
          likelyFix: "Inspect both explicit properties, entity-domain selection, and the two-hop search budget.",
          notabilityScore: (endpoints[0].attempts ?? 0) * 20 + (endpoints[1].attempts ?? 0) * 20 + Math.log2(2 + (endpoints[0].degree ?? 0) + (endpoints[1].degree ?? 0)),
        });
        addedForMiddle += 1;
      }
    }
  }
  return dedupeCandidates(candidates);
}

export function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates
    .sort((left, right) => right.notabilityScore - left.notabilityScore || stableNumber(left.id) - stableNumber(right.id))
    .filter((candidate) => {
      const key = undirectedPairKey(candidate.source.qid, candidate.target.qid);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function selectBalancedCorpus(directCandidates, twoHopCandidates, sampleSize) {
  const directTarget = Math.max(0, sampleSize - Math.round(sampleSize * 0.2));
  const selected = [];
  const selectedPairs = new Set();

  const roundRobin = (candidates, target) => {
    const groups = new Map();
    for (const candidate of candidates) {
      const group = groups.get(candidate.relationshipFamily) ?? [];
      group.push(candidate);
      groups.set(candidate.relationshipFamily, group);
    }
    const queues = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
    let cursor = 0;
    while (selected.length < target && queues.some(([, queue]) => queue.length > 0)) {
      const [, queue] = queues[cursor % queues.length];
      cursor += 1;
      const candidate = queue.shift();
      if (!candidate) continue;
      const key = undirectedPairKey(candidate.source.qid, candidate.target.qid);
      if (selectedPairs.has(key)) continue;
      selectedPairs.add(key);
      selected.push(candidate);
    }
  };

  roundRobin(directCandidates, directTarget);
  roundRobin(twoHopCandidates, sampleSize);
  if (selected.length < sampleSize) roundRobin([...directCandidates, ...twoHopCandidates], sampleSize);
  return selected.slice(0, sampleSize);
}

function rejectedPenalty(diagnostics) {
  const rejected = diagnostics?.bestRejectedPath;
  if (!rejected || typeof rejected !== "object") return 0;
  return Number(rejected.patternPenalty ?? rejected.scoreBreakdown?.patternPenalty ?? 0) || 0;
}

export function diagnoseFailure(pair, result, evidence) {
  if (result.found) return [];
  const causes = [];
  const diagnostics = result.diagnostics ?? {};
  const termination = text(diagnostics.terminationReason ?? result.terminationReason).toLowerCase();
  const missingEntities = evidence.missingEntityQids ?? [];
  const disabled = pair.expectedProperties.filter((property) => !evidence.enabledProperties.includes(property));
  const unselected = pair.expectedProperties.filter((property) => !evidence.selectedProperties.includes(property));

  if (disabled.length > 0) causes.push("property not enabled");
  if (pair.queryDirection === "reverse" && pair.expectedProperties.some((property) => !evidence.reverseEnabledProperties.includes(property))) causes.push("reverse traversal not enabled");
  if (disabled.length === 0 && unselected.length > 0) causes.push("property not selected for entity domain");
  if ([pair.source.type, pair.target.type].includes("entity")) causes.push("domain classification missing/wrong");
  if (termination.includes("fanout") || diagnostics.fanoutBlocked === true) causes.push("fanout cap blocked needed entity");
  if (termination.includes("budget") || termination.includes("depth") || diagnostics.budgetExhausted === true) causes.push("depth/budget limit");
  if (diagnostics.timedOut === true || termination.includes("timeout") || termination.includes("time-budget")) causes.push("timeout");
  if (diagnostics.bestRejectedPath) causes.push("path exists in Neo4j but scoring rejected it");
  if (rejectedPenalty(diagnostics) > 0) causes.push("path-pattern penalty rejected it");
  if ((result.httpStatus ?? 0) >= 500 || termination.includes("upstream") || termination.includes("wikidata")) causes.push("upstream lookup failed");
  if (missingEntities.length > 0) causes.push("entity missing from graph");
  if (causes.length === 0) causes.push("depth/budget limit");
  return [...new Set(causes)];
}

export function clusterFailures(results) {
  const clusters = new Map();
  const testedByShape = new Map();
  for (const result of results) {
    const key = `${result.relationshipFamily}|${result.sourceDomain}|${result.targetDomain}`;
    testedByShape.set(key, (testedByShape.get(key) ?? 0) + 1);
  }
  for (const result of results) {
    const causes = result.failureCauses.length > 0 ? result.failureCauses : ["none"];
    for (const cause of causes) {
      const key = `${result.relationshipFamily}|${result.sourceDomain}|${result.targetDomain}|${cause}`;
      const cluster = clusters.get(key) ?? {
        id: createHash("sha1").update(key).digest("hex").slice(0, 12),
        relationshipFamily: result.relationshipFamily,
        relationshipFamilyLabel: result.relationshipFamilyLabel,
        properties: new Set(),
        sourceDomain: result.sourceDomain,
        targetDomain: result.targetDomain,
        failureCause: cause,
        tested: 0,
        failures: 0,
        relevance: result.relevance,
        complexity: result.complexity,
        likelyFix: result.likelyFix,
        representativePairs: [],
        attemptFrequency: 0,
      };
      cluster.tested = testedByShape.get(`${result.relationshipFamily}|${result.sourceDomain}|${result.targetDomain}`) ?? 0;
      if (result.falseNegative) cluster.failures += 1;
      for (const property of result.expectedProperties) cluster.properties.add(property);
      cluster.attemptFrequency += result.productionAttemptFrequency ?? 0;
      if (result.falseNegative && cluster.representativePairs.length < 5) {
        cluster.representativePairs.push({ sourceQid: result.sourceQid, sourceName: result.sourceName, targetQid: result.targetQid, targetName: result.targetName });
      }
      clusters.set(key, cluster);
    }
  }
  return [...clusters.values()]
    .filter((cluster) => cluster.failures > 0)
    .map((cluster) => {
      const falseNegativeRate = cluster.tested === 0 ? 0 : cluster.failures / cluster.tested;
      const complexityPenalty = { low: 0, medium: 8, high: 16 }[cluster.complexity] ?? 8;
      const priorityScore = Math.round((cluster.failures * 4 + falseNegativeRate * 35 + cluster.relevance * 6 + Math.log2(1 + cluster.attemptFrequency) * 3 - complexityPenalty) * 10) / 10;
      return { ...cluster, properties: [...cluster.properties].sort(), falseNegativeRate, priorityScore };
    })
    .sort((left, right) => right.priorityScore - left.priorityScore || right.failures - left.failures);
}

export function summarizeGapResults(results) {
  const falseNegatives = results.filter((result) => result.falseNegative).length;
  const runtimes = results.map((result) => result.runtimeMs).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    totalPairs: results.length,
    found: results.length - falseNegatives,
    falseNegatives,
    falseNegativeRate: results.length === 0 ? 0 : falseNegatives / results.length,
    averageRuntimeMs: runtimes.length === 0 ? 0 : Math.round(runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length),
    medianRuntimeMs: runtimes.length === 0 ? 0 : runtimes[Math.floor(runtimes.length / 2)],
  };
}

export function compareGapReports(before, after) {
  const beforeById = new Map(before.results.map((result) => [result.pairId, result]));
  const afterById = new Map(after.results.map((result) => [result.pairId, result]));
  const fixed = [];
  const introduced = [];
  for (const [id, current] of afterById) {
    const previous = beforeById.get(id);
    if (!previous) continue;
    if (previous.falseNegative && !current.falseNegative) fixed.push(id);
    if (!previous.falseNegative && current.falseNegative) introduced.push(id);
  }
  const rates = (report) => new Map(report.clusters.map((cluster) => [cluster.relationshipFamily, cluster.falseNegativeRate]));
  const beforeRates = rates(before);
  const afterRates = rates(after);
  const familyIds = new Set([...beforeRates.keys(), ...afterRates.keys()]);
  const changes = [...familyIds].map((relationshipFamily) => ({
    relationshipFamily,
    beforeRate: beforeRates.get(relationshipFamily) ?? 0,
    afterRate: afterRates.get(relationshipFamily) ?? 0,
  }));
  return {
    beforeRunId: before.runId,
    afterRunId: after.runId,
    falseNegativesFixed: fixed,
    newFalseNegatives: introduced,
    clustersImproved: changes.filter((item) => item.afterRate < item.beforeRate).sort((a, b) => (b.beforeRate - b.afterRate) - (a.beforeRate - a.afterRate)),
    clustersRegressed: changes.filter((item) => item.afterRate > item.beforeRate).sort((a, b) => (b.afterRate - b.beforeRate) - (a.afterRate - a.beforeRate)),
  };
}

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function gapResultsToCsv(results) {
  const columns = ["pairId", "relationshipFamily", "expectedProperties", "sourceQid", "sourceName", "sourceDomain", "targetQid", "targetName", "targetDomain", "found", "falseNegative", "returnedPath", "qualityBand", "score", "runtimeMs", "stage", "terminationReason", "failureCauses"];
  return `${columns.join(",")}\n${results.map((result) => columns.map((column) => csvCell(Array.isArray(result[column]) ? result[column].join(" | ") : result[column])).join(",")).join("\n")}\n`;
}
