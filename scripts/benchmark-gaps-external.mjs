import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import neo4j from "neo4j-driver";
import { detectSuspiciousPatterns } from "./domain-benchmark-lib.mjs";
import { APPROVED_WIKIDATA_PROPERTIES } from "../lib/wikidata-properties.ts";
import { selectIncomingDiscoveryProperties, selectOutgoingDiscoveryProperties } from "../lib/discovery-policy.ts";
import {
  EXTERNAL_GAP_SCAN_CONFIG_VERSION,
  EXTERNAL_GAP_SCAN_PROPERTIES,
} from "./external-gap-scan-config.mjs";
import {
  buildExternalCandidates,
  buildExternalReportSections,
  compareExternalReports,
  diagnoseExternalFailure,
  externalResultsToCsv,
  isRetryableExternalResult,
  primaryExternalFailureCause,
  selectBalancedExternalCorpus,
  selectExternalDevelopmentCorpus,
  supportStatusCounts,
} from "./external-gap-scan-lib.mjs";

const ROOT = process.cwd();
const GAP_DIRECTORY = join(ROOT, "benchmarks", "gap-scan");
const CACHE_DIRECTORY = join(GAP_DIRECTORY, ".cache", "external");
const EXTERNAL_REPORT_DIRECTORY = join(GAP_DIRECTORY, "reports", "external");
const CORPUS_PATH = join(GAP_DIRECTORY, "external-corpus.json");
const ENDPOINT = process.env.WIKIDATA_SPARQL_ENDPOINT ?? "https://query.wikidata.org/sparql";
const USER_AGENT = process.env.WIKIDATA_USER_AGENT ?? "HowConnectedExternalCoverageScanner/1.0 (https://howconnected.com; contact via site)";
const sleep = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const argValue = (name) => process.argv.slice(2).find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const hasArg = (name) => process.argv.slice(2).includes(`--${name}`);
const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const options = {
  sampleSize: boundedInteger(argValue("sample"), 500, 10, 1_000),
  family: argValue("family"),
  property: argValue("property")?.toUpperCase() ?? null,
  domain: argValue("domain"),
  concurrency: boundedInteger(argValue("concurrency"), 1, 1, 3),
  delayMs: boundedInteger(argValue("delay"), 1_000, 100, 5_000),
  wikidataDelayMs: boundedInteger(argValue("wikidata-delay"), 1_200, 500, 10_000),
  timeoutMs: boundedInteger(argValue("timeout"), 25_000, 10_000, 60_000),
  baseUrl: argValue("base-url") ?? process.env.GAP_SCAN_BASE_URL ?? "http://127.0.0.1:3000",
  resume: hasArg("resume"),
  regenerate: hasArg("regenerate"),
  generateOnly: hasArg("generate-only"),
  compare: argValue("compare"),
  subset: argValue("subset"),
};
if (options.subset && options.subset !== "development") throw new Error(`Unknown external subset: ${options.subset}`);
const REPORT_DIRECTORY = options.subset === "development"
  ? join(EXTERNAL_REPORT_DIRECTORY, "development")
  : EXTERNAL_REPORT_DIRECTORY;

await Promise.all([mkdir(CACHE_DIRECTORY, { recursive: true }), mkdir(REPORT_DIRECTORY, { recursive: true })]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileJson(path) {
  try { return await readJson(path); } catch { return null; }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

if (options.compare) {
  const paths = options.compare.split(",").map((value) => resolve(ROOT, value));
  if (paths.length !== 2) throw new Error("--compare requires two comma-separated external report paths.");
  const [before, after] = await Promise.all(paths.map(readJson));
  console.log(JSON.stringify(compareExternalReports(before, after), null, 2));
  process.exit(0);
}

const selectedConfigs = EXTERNAL_GAP_SCAN_PROPERTIES.filter((config) => {
  if (options.family && config.family !== options.family) return false;
  if (options.property && config.id !== options.property) return false;
  if (options.domain && ![...config.sourceDomains, ...config.targetDomains].includes(options.domain)) return false;
  return true;
});
if (selectedConfigs.length === 0) throw new Error("No external property configuration matched the requested filters.");

function sparqlFor(config, limit) {
  return `
SELECT DISTINCT ?source ?target WHERE {
  ?source wdt:${config.id} ?target .
  FILTER(STRSTARTS(STR(?source), "http://www.wikidata.org/entity/Q"))
  FILTER(STRSTARTS(STR(?target), "http://www.wikidata.org/entity/Q"))
}
ORDER BY ?source ?target
LIMIT ${limit}`.trim();
}

async function fetchSparql(config, limit) {
  const cachePath = join(CACHE_DIRECTORY, `wikidata-${EXTERNAL_GAP_SCAN_CONFIG_VERSION}-${config.id}-${limit}.json`);
  if (!options.regenerate) {
    const cached = await fileJson(cachePath);
    if (cached?.results?.bindings) return cached.results.bindings;
  }
  const url = new URL(ENDPOINT);
  url.searchParams.set("query", sparqlFor(config, limit));
  url.searchParams.set("format", "json");
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if ([429, 503].includes(response.status)) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        await sleep(Math.min(60_000, Number.isFinite(retryAfter) ? retryAfter * 1_000 : 5_000 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Wikidata query ${config.id} returned HTTP ${response.status}`);
      const payload = await response.json();
      await writeJsonAtomic(cachePath, payload);
      return payload.results?.bindings ?? [];
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(3_000 * (attempt + 1));
    }
  }
  throw lastError ?? new Error(`Wikidata query failed for ${config.id}`);
}

async function fetchEntityMetadata(qids) {
  const cachePath = join(CACHE_DIRECTORY, `entity-metadata-${EXTERNAL_GAP_SCAN_CONFIG_VERSION}.json`);
  const cached = await fileJson(cachePath) ?? {};
  const metadata = new Map(Object.entries(cached));
  const missing = [...new Set(qids)].filter((qid) => !metadata.has(qid));
  for (let index = 0; index < missing.length; index += 50) {
    if (index > 0) await sleep(options.wikidataDelayMs);
    const chunk = missing.slice(index, index + 50);
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({ action: "wbgetentities", format: "json", ids: chunk.join("|"), props: "labels|descriptions", languages: "en", origin: "*" });
    let payload = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if ([429, 503].includes(response.status)) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        await sleep(Math.min(60_000, Number.isFinite(retryAfter) ? retryAfter * 1_000 : 5_000 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Wikidata entity metadata returned HTTP ${response.status}`);
      payload = await response.json();
      break;
    }
    if (!payload) throw new Error(`Wikidata entity metadata failed for ${chunk[0]}–${chunk.at(-1)}`);
    for (const qid of chunk) {
      const entity = payload.entities?.[qid];
      metadata.set(qid, { name: entity?.labels?.en?.value ?? qid, description: entity?.descriptions?.en?.value ?? "" });
    }
    await writeJsonAtomic(cachePath, Object.fromEntries(metadata));
  }
  return metadata;
}

async function enrichPairs(pairs) {
  const metadata = await fetchEntityMetadata(pairs.flatMap((pair) => [pair.source.qid, pair.target.qid]));
  return pairs.map((pair) => ({
    ...pair,
    source: { ...pair.source, ...(metadata.get(pair.source.qid) ?? {}) },
    target: { ...pair.target, ...(metadata.get(pair.target.qid) ?? {}) },
  }));
}

function corpusMatchesFilters(pair) {
  if (options.family && pair.relationshipFamily !== options.family) return false;
  if (options.property && pair.wikidataProperty !== options.property) return false;
  if (options.domain && ![pair.source.type, pair.target.type].includes(options.domain)) return false;
  return true;
}

async function loadOrGenerateCorpus() {
  const existing = await fileJson(CORPUS_PATH);
  if (!options.regenerate && existing?.configVersion === EXTERNAL_GAP_SCAN_CONFIG_VERSION) {
    const matching = existing.pairs.filter(corpusMatchesFilters);
    if (matching.length >= options.sampleSize) return { ...existing, pairs: matching.slice(0, options.sampleSize) };
  }
  const perPropertyLimit = Math.min(1_000, Math.max(30, Math.ceil(options.sampleSize / selectedConfigs.length) * 3));
  const candidates = [];
  for (const [index, config] of selectedConfigs.entries()) {
    if (index > 0) await sleep(options.wikidataDelayMs);
    const bindings = await fetchSparql(config, perPropertyLimit);
    const propertyCandidates = buildExternalCandidates(config, bindings);
    candidates.push(...propertyCandidates);
    console.log(`Wikidata ${config.id} ${config.label}: ${propertyCandidates.length} explicit pairs cached.`);
  }
  const selectedPairs = selectBalancedExternalCorpus(candidates, options.sampleSize);
  if (selectedPairs.length < options.sampleSize) throw new Error(`Only ${selectedPairs.length} unique external Wikidata pairs were available; requested ${options.sampleSize}. Use a smaller --sample or broaden filters.`);
  const pairs = await enrichPairs(selectedPairs);
  const corpus = {
    schemaVersion: 1,
    configVersion: EXTERNAL_GAP_SCAN_CONFIG_VERSION,
    generatedAt: new Date().toISOString(),
    source: "Wikidata Query Service explicit truthy statements",
    endpoint: ENDPOINT,
    requestedSampleSize: options.sampleSize,
    supportStatusCounts: supportStatusCounts(selectedConfigs),
    pairs,
  };
  if (!options.family && !options.property && !options.domain && options.sampleSize >= 500) await writeJsonAtomic(CORPUS_PATH, corpus);
  return corpus;
}

const loadedCorpus = await loadOrGenerateCorpus();
const corpus = options.subset === "development"
  ? { ...loadedCorpus, pairs: selectExternalDevelopmentCorpus(loadedCorpus.pairs, Math.min(100, options.sampleSize)) }
  : loadedCorpus;
console.log(`External corpus: ${corpus.pairs.length} pairs across ${new Set(corpus.pairs.map(({ wikidataProperty }) => wikidataProperty)).size} properties.`);
if (options.generateOnly) process.exit(0);

const corpusHash = createHash("sha256").update(JSON.stringify(corpus.pairs.map(({ id }) => id))).digest("hex").slice(0, 16);
const progressPath = join(CACHE_DIRECTORY, `progress-${corpusHash}.json`);
const priorProgress = options.resume ? await fileJson(progressPath) : null;
const reusableResults = (priorProgress?.results ?? []).filter((result) => !isRetryableExternalResult(result));
const resultsById = new Map(reusableResults.map((result) => [result.pairId, result]));
if (priorProgress && reusableResults.length !== priorProgress.results.length) {
  console.log(`Retrying ${priorProgress.results.length - reusableResults.length} checkpoint results that ended in an upstream failure.`);
}
const configuredProperties = Object.values(APPROVED_WIKIDATA_PROPERTIES);
const enabledProperties = configuredProperties.map(({ wikidataProperty }) => wikidataProperty);
const reverseEnabledProperties = configuredProperties.filter(({ reverseDiscoveryEnabled }) => reverseDiscoveryEnabled).map(({ wikidataProperty }) => wikidataProperty);

function selectedProperties(domain, direction) {
  try {
    const selected = direction === "reverse"
      ? selectIncomingDiscoveryProperties(domain, configuredProperties, configuredProperties.length)
      : selectOutgoingDiscoveryProperties(domain, configuredProperties);
    return selected.map(({ wikidataProperty }) => wikidataProperty);
  } catch { return []; }
}

async function discover(pair) {
  const startedAt = performance.now();
  const url = new URL("/api/discover", options.baseUrl);
  url.search = new URLSearchParams({ fromQid: pair.source.qid, toQid: pair.target.qid, debug: "1" });
  let response = null;
  let body = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs), headers: { "User-Agent": USER_AGENT } });
      body = await response.json();
      if (![429, 502, 503].includes(response.status) || attempt === 3) break;
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
      await sleep(Math.min(60_000, Number.isFinite(retryAfter) ? retryAfter * 1_000 : 15_000 * (attempt + 1)));
    } catch (error) {
      body = { found: false, error: error instanceof Error ? error.message : "request failed" };
      if (attempt === 3) break;
      await sleep(5_000 * (attempt + 1));
    }
  }
  const bestPath = body?.bestPath ?? null;
  const suspiciousPatterns = detectSuspiciousPatterns(bestPath);
  return {
    pairId: pair.id,
    wikidataProperty: pair.wikidataProperty,
    expectedRelationship: pair.expectedRelationship,
    relationshipFamily: pair.relationshipFamily,
    supportStatus: pair.supportStatus,
    sourceQid: pair.source.qid,
    sourceName: pair.source.name,
    sourceDomain: pair.source.type,
    targetQid: pair.target.qid,
    targetName: pair.target.name,
    targetDomain: pair.target.type,
    found: body?.found === true,
    falseNegative: body?.found !== true,
    returnedPath: bestPath?.nodes?.map((node) => node.name ?? node.qid) ?? [],
    returnedRelationships: bestPath?.relationships?.map((relationship) => relationship.label ?? relationship.storedType) ?? [],
    pathDetails: bestPath,
    suspicious: suspiciousPatterns.length > 0,
    suspiciousPatterns,
    qualityBand: bestPath?.qualityBand ?? null,
    score: bestPath?.score ?? null,
    runtimeMs: Math.round(performance.now() - startedAt),
    stage: body?.diagnostics?.stage ?? null,
    terminationReason: body?.diagnostics?.terminationReason ?? body?.error ?? "unknown",
    httpStatus: response?.status ?? null,
    diagnostics: body?.diagnostics ?? null,
    productionAttemptFrequency: 0,
    failureCauses: [],
  };
}

let cursor = 0;
let completedSinceSave = 0;
let checkpointWrite = Promise.resolve();
const saveCheckpoint = () => {
  checkpointWrite = checkpointWrite.then(() => writeJsonAtomic(progressPath, {
    corpusHash,
    updatedAt: new Date().toISOString(),
    results: [...resultsById.values()],
  }));
  return checkpointWrite;
};
const pending = corpus.pairs.filter(({ id }) => !resultsById.has(id));
console.log(`Running ${pending.length} pending external pairs with concurrency ${options.concurrency} and ${options.delayMs}ms pacing.`);
async function worker(workerIndex) {
  while (true) {
    const index = cursor;
    cursor += 1;
    const pair = pending[index];
    if (!pair) return;
    if (index > 0 || workerIndex > 0) await sleep(options.delayMs);
    const result = await discover(pair);
    resultsById.set(pair.id, result);
    completedSinceSave += 1;
    console.log(`[${resultsById.size}/${corpus.pairs.length}] ${pair.wikidataProperty} ${pair.source.name} → ${pair.target.name}: ${result.found ? "found" : "MISS"} ${result.runtimeMs}ms`);
    if (completedSinceSave >= 5) {
      completedSinceSave = 0;
      await saveCheckpoint();
    }
  }
}
await Promise.all(Array.from({ length: options.concurrency }, (_, index) => worker(index)));

async function loadGraphEvidence(pairs) {
  const missing = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"].filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) return new Map();
  const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
  try {
    const rows = pairs.map((pair) => ({ pairId: pair.id, sourceQid: pair.source.qid, targetQid: pair.target.qid, property: pair.wikidataProperty }));
    const result = await driver.executeQuery(`
      UNWIND $rows AS row
      OPTIONAL MATCH (source:Entity {qid: row.sourceQid})
      OPTIONAL MATCH (target:Entity {qid: row.targetQid})
      OPTIONAL MATCH (source)-[relationship]->(target)
      WHERE relationship.wikidataProperty = row.property
      OPTIONAL MATCH (attempt:ConnectionAttempt)
      WHERE (attempt.fromQid = row.sourceQid AND attempt.toQid = row.targetQid)
         OR (attempt.fromQid = row.targetQid AND attempt.toQid = row.sourceQid)
      RETURN row.pairId AS pairId,
             source IS NOT NULL AS sourcePresent,
             target IS NOT NULL AS targetPresent,
             source.type AS sourceDomain,
             target.type AS targetDomain,
             count(DISTINCT relationship) > 0 AS relationshipPresent,
             count(DISTINCT attempt) AS attemptFrequency
    `, { rows }, { routing: neo4j.routing.READ });
    return new Map(result.records.map((record) => [record.get("pairId"), {
      sourcePresent: record.get("sourcePresent"),
      targetPresent: record.get("targetPresent"),
      sourceDomain: record.get("sourceDomain") ?? null,
      targetDomain: record.get("targetDomain") ?? null,
      relationshipPresent: record.get("relationshipPresent"),
      attemptFrequency: neo4j.isInt(record.get("attemptFrequency")) ? record.get("attemptFrequency").toNumber() : Number(record.get("attemptFrequency") ?? 0),
    }]));
  } finally { await driver.close(); }
}

const rawResults = corpus.pairs.map((pair) => resultsById.get(pair.id)).filter(Boolean);
const evidenceById = await loadGraphEvidence(corpus.pairs);
const pairById = new Map(corpus.pairs.map((pair) => [pair.id, pair]));
const results = rawResults.map((result) => {
  const pair = pairById.get(result.pairId);
  const graph = evidenceById.get(result.pairId) ?? {};
  const sourceDomain = graph.sourceDomain ?? result.sourceDomain;
  const targetDomain = graph.targetDomain ?? result.targetDomain;
  const enriched = { ...result, sourceDomain, targetDomain, productionAttemptFrequency: graph.attemptFrequency ?? 0 };
  const failureCauses = diagnoseExternalFailure(pair, enriched, {
    enabledProperties,
    reverseEnabledProperties,
    sourceSelectedProperties: selectedProperties(sourceDomain, "outgoing"),
    targetReverseSelectedProperties: selectedProperties(targetDomain, "reverse"),
    sourcePresent: graph.sourcePresent,
    targetPresent: graph.targetPresent,
    relationshipPresent: graph.relationshipPresent,
    sourceDomain,
    targetDomain,
  });
  const inconclusive = failureCauses.includes("upstream failure");
  return {
    ...enriched,
    inconclusive,
    falseNegative: !enriched.found && !inconclusive,
    primaryFailureCause: primaryExternalFailureCause(failureCauses),
    failureCauses,
  };
});
resultsById.clear();
for (const result of results) resultsById.set(result.pairId, result);
await saveCheckpoint();

const conclusiveResults = results.filter(({ inconclusive }) => !inconclusive);
const runtimes = conclusiveResults.map(({ runtimeMs }) => runtimeMs).sort((a, b) => a - b);
const falseNegatives = conclusiveResults.filter(({ falseNegative }) => falseNegative).length;
const summary = {
  totalPairs: results.length,
  conclusivePairs: conclusiveResults.length,
  inconclusivePairs: results.length - conclusiveResults.length,
  found: conclusiveResults.length - falseNegatives,
  falseNegatives,
  falseNegativeRate: conclusiveResults.length === 0 ? 0 : falseNegatives / conclusiveResults.length,
  averageRuntimeMs: conclusiveResults.length === 0 ? 0 : Math.round(runtimes.reduce((sum, runtime) => sum + runtime, 0) / conclusiveResults.length),
  medianRuntimeMs: runtimes[Math.floor(runtimes.length / 2)] ?? 0,
  p95RuntimeMs: runtimes[Math.max(0, Math.ceil(runtimes.length * 0.95) - 1)] ?? 0,
  timeoutCount: conclusiveResults.filter((result) => result.failureCauses.includes("timeout")).length,
  timeoutRate: conclusiveResults.length === 0 ? 0 : conclusiveResults.filter((result) => result.failureCauses.includes("timeout")).length / conclusiveResults.length,
  suspiciousPathCount: conclusiveResults.filter(({ found, suspicious }) => found && suspicious).length,
  suspiciousPathRate: conclusiveResults.length === 0 ? 0 : conclusiveResults.filter(({ found, suspicious }) => found && suspicious).length / conclusiveResults.length,
};
const sections = buildExternalReportSections(results, selectedConfigs);
const runId = new Date().toISOString().replaceAll(":", "-");
const report = {
  schemaVersion: 1,
  mode: "external",
  runId,
  generatedAt: new Date().toISOString(),
  configVersion: EXTERNAL_GAP_SCAN_CONFIG_VERSION,
  corpusHash,
  options: { sampleSize: corpus.pairs.length, family: options.family, property: options.property, domain: options.domain, subset: options.subset, concurrency: options.concurrency, delayMs: options.delayMs },
  summary,
  ...sections,
  results,
};
const previous = await fileJson(join(REPORT_DIRECTORY, "latest.json"));
const markdown = renderMarkdown(report);
await Promise.all([
  writeJsonAtomic(join(REPORT_DIRECTORY, `${runId}.json`), report),
  writeFile(join(REPORT_DIRECTORY, `${runId}.csv`), externalResultsToCsv(results), "utf8"),
  writeFile(join(REPORT_DIRECTORY, `${runId}.md`), markdown, "utf8"),
  writeJsonAtomic(join(REPORT_DIRECTORY, "latest.json"), report),
  writeFile(join(REPORT_DIRECTORY, "latest.csv"), externalResultsToCsv(results), "utf8"),
  writeFile(join(REPORT_DIRECTORY, "latest.md"), markdown, "utf8"),
]);
if (previous) await writeJsonAtomic(join(REPORT_DIRECTORY, "comparison.json"), compareExternalReports(previous, report));

console.log("\nExternal Wikidata coverage summary");
console.log({ ...summary, falseNegativeRate: `${(summary.falseNegativeRate * 100).toFixed(1)}%` });
console.table(report.propertyCoverage.slice(0, 15).map((item) => ({ property: item.wikidataProperty, label: item.propertyLabel, status: item.supportStatus, tested: item.tested, misses: item.falseNegatives, failureRate: `${(item.falseNegativeRate * 100).toFixed(1)}%`, cause: item.dominantFailureCause })));
console.log(`Reports: ${REPORT_DIRECTORY}`);

function renderMarkdown(value) {
  const percent = (rate) => `${(rate * 100).toFixed(1)}%`;
  const lines = [
    "# HowConnected External Wikidata Coverage",
    "",
    `Generated: ${value.generatedAt}`,
    `Pairs tested: ${value.summary.totalPairs}`,
    `Conclusive pairs: ${value.summary.conclusivePairs}`,
    `Inconclusive upstream failures: ${value.summary.inconclusivePairs}`,
    `False negatives: ${value.summary.falseNegatives} (${percent(value.summary.falseNegativeRate)})`,
    `Average runtime: ${value.summary.averageRuntimeMs} ms`,
    `Median / p95 runtime: ${value.summary.medianRuntimeMs} / ${value.summary.p95RuntimeMs} ms`,
    `Timeouts: ${value.summary.timeoutCount} (${percent(value.summary.timeoutRate)})`,
    `Suspicious found paths: ${value.summary.suspiciousPathCount} (${percent(value.summary.suspiciousPathRate)})`,
    "",
    "## Property coverage",
    "",
    "| Property | Relationship | Support | Tested | Misses | Failure rate | Dominant cause |",
    "|---|---|---|---:|---:|---:|---|",
    ...value.propertyCoverage.map((item) => `| ${item.wikidataProperty} | ${item.propertyLabel} | ${item.supportStatus} | ${item.tested} | ${item.falseNegatives} | ${percent(item.falseNegativeRate)} | ${item.dominantFailureCause ?? "—"} |`),
    "",
    "## Relationship-family coverage",
    "",
    "| Family | Properties | Tested | Misses | Failure rate | Dominant cause |",
    "|---|---|---:|---:|---:|---|",
    ...value.familyCoverage.map((item) => `| ${item.relationshipFamily} | ${item.properties.join(", ")} | ${item.tested} | ${item.falseNegatives} | ${percent(item.falseNegativeRate)} | ${item.dominantFailureCause ?? "—"} |`),
    "",
    "## Unsupported properties",
    "",
    ...value.unsupportedProperties.flatMap((item) => [`### ${item.property} ${item.propertyLabel}`, "", `- Sample pairs: ${item.samplePairCount}`, `- Sample failure rate: ${item.sampleFailureRate === null ? "n/a" : percent(item.sampleFailureRate)}`, `- Likely domains: ${item.likelySourceDomains.join(", ")} → ${item.likelyTargetDomains.join(", ")}`, `- Estimated complexity: ${item.implementationComplexity}`, ...item.representativeExamples.map((pair) => `  - ${pair.sourceName} (${pair.sourceQid}) → ${pair.targetName} (${pair.targetQid})`), ""]),
    "## Top semantic backlog",
    "",
    ...value.recommendations.flatMap((item) => [`### ${item.rank}. ${item.property} ${item.propertyLabel}`, "", `- Family: ${item.relationshipFamily}`, `- Root cause: ${item.rootCause}`, `- Failures: ${item.falseNegatives}/${item.tested} (${percent(item.falseNegativeRate)})`, `- Likely code area: ${item.likelyCodeArea}`, `- Expected coverage gain: up to ${item.expectedCoverageGain} sampled pairs`, `- Generic-hub pollution risk: ${item.hubPollutionRisk}`, `- Complexity: ${item.complexity}`, `- Priority score: ${item.priorityScore}`, ...item.representativeFailures.map((pair) => `  - ${pair.sourceName} (${pair.sourceQid}) → ${pair.targetName} (${pair.targetQid})`), ""]),
  ];
  return `${lines.join("\n")}\n`;
}
