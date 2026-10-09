import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import neo4j from "neo4j-driver";
import { APPROVED_WIKIDATA_PROPERTIES } from "../lib/wikidata-properties.ts";
import { selectOutgoingDiscoveryProperties } from "../lib/discovery-policy.ts";
import {
  GAP_SCAN_CONFIG_VERSION,
  GAP_SCAN_FAMILIES,
  GAP_SCAN_PROPERTY_IDS,
  GAP_SCAN_TWO_HOP_TEMPLATES,
} from "./gap-scan-config.mjs";
import {
  clusterFailures,
  compareGapReports,
  diagnoseFailure,
  gapResultsToCsv,
  generateDirectCandidates,
  generateTwoHopCandidates,
  selectBalancedCorpus,
  summarizeGapResults,
} from "./gap-scan-lib.mjs";

const ROOT = process.cwd();
const GAP_DIRECTORY = join(ROOT, "benchmarks", "gap-scan");
const REPORT_DIRECTORY = join(GAP_DIRECTORY, "reports");
const CACHE_DIRECTORY = join(GAP_DIRECTORY, ".cache");
const CORPUS_PATH = join(GAP_DIRECTORY, "corpus.json");

const sleep = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const argValue = (name) => {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
};
const hasArg = (name) => process.argv.slice(2).includes(`--${name}`);
const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const requestedMode = argValue("mode") ?? "internal";
if (requestedMode === "external") {
  await import("./benchmark-gaps-external.mjs");
  process.exit(0);
}
if (requestedMode !== "internal") throw new Error(`Unknown gap-scan mode: ${requestedMode}`);

const options = {
  sampleSize: boundedInteger(argValue("sample"), 500, 10, 1_000),
  concurrency: boundedInteger(argValue("concurrency"), 2, 1, 4),
  delayMs: boundedInteger(argValue("delay"), 250, 0, 5_000),
  timeoutMs: boundedInteger(argValue("timeout"), 25_000, 10_000, 60_000),
  baseUrl: argValue("base-url") ?? process.env.GAP_SCAN_BASE_URL ?? "http://127.0.0.1:3000",
  family: argValue("family"),
  domain: argValue("domain"),
  regenerate: hasArg("regenerate"),
  fresh: hasArg("fresh"),
  generateOnly: hasArg("generate-only"),
  compare: argValue("compare"),
};

await Promise.all([
  mkdir(GAP_DIRECTORY, { recursive: true }),
  mkdir(REPORT_DIRECTORY, { recursive: true }),
  mkdir(CACHE_DIRECTORY, { recursive: true }),
]);

if (options.compare) {
  const [beforePath, afterPath] = options.compare.split(",").map((value) => resolve(ROOT, value));
  if (!beforePath || !afterPath) throw new Error("--compare requires two comma-separated report paths.");
  const [before, after] = await Promise.all([readJson(beforePath), readJson(afterPath)]);
  console.log(JSON.stringify(compareGapReports(before, after), null, 2));
  process.exit(0);
}

function numberValue(value) {
  if (typeof value === "number") return value;
  if (neo4j.isInt(value)) return value.toNumber();
  return 0;
}

function nodeFromRecord(record, prefix, attemptsByQid) {
  const qid = record.get(`${prefix}Qid`);
  return {
    qid,
    name: record.get(`${prefix}Name`) || qid,
    description: record.get(`${prefix}Description`) || "",
    type: record.get(`${prefix}Type`) || "entity",
    degree: numberValue(record.get(`${prefix}Degree`)),
    attempts: attemptsByQid.get(qid) ?? 0,
  };
}

async function loadGraphEdges() {
  const missing = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"].filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) throw new Error(`Missing Neo4j configuration: ${missing.join(", ")}`);
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  );
  try {
    const [edgeResult, attemptResult] = await Promise.all([
      driver.executeQuery(
        `
          MATCH (source:Entity)-[relationship]->(target:Entity)
          WHERE relationship.wikidataProperty IN $properties
            AND source.qid =~ 'Q[1-9][0-9]*'
            AND target.qid =~ 'Q[1-9][0-9]*'
          RETURN source.qid AS sourceQid,
                 coalesce(source.name, source.qid) AS sourceName,
                 coalesce(source.description, '') AS sourceDescription,
                 coalesce(source.type, 'entity') AS sourceType,
                 COUNT { (source)--() } AS sourceDegree,
                 target.qid AS targetQid,
                 coalesce(target.name, target.qid) AS targetName,
                 coalesce(target.description, '') AS targetDescription,
                 coalesce(target.type, 'entity') AS targetType,
                 COUNT { (target)--() } AS targetDegree,
                 type(relationship) AS relationshipType,
                 relationship.wikidataProperty AS property
          LIMIT 50000
        `,
        { properties: GAP_SCAN_PROPERTY_IDS },
        { routing: neo4j.routing.READ },
      ),
      driver.executeQuery(
        `
          MATCH (attempt:ConnectionAttempt)
          UNWIND [attempt.fromQid, attempt.toQid] AS qid
          WITH qid, count(*) AS attempts
          WHERE qid =~ 'Q[1-9][0-9]*'
          RETURN qid, attempts
        `,
        {},
        { routing: neo4j.routing.READ },
      ).catch(() => ({ records: [] })),
    ]);
    const attemptsByQid = new Map(attemptResult.records.map((record) => [record.get("qid"), numberValue(record.get("attempts"))]));
    return edgeResult.records.map((record) => ({
      source: nodeFromRecord(record, "source", attemptsByQid),
      target: nodeFromRecord(record, "target", attemptsByQid),
      relationshipType: record.get("relationshipType"),
      property: record.get("property"),
    }));
  } finally {
    await driver.close();
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileJson(path) {
  try {
    return await readJson(path);
  } catch {
    return null;
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function filterPair(pair) {
  if (options.family && pair.relationshipFamily !== options.family) return false;
  if (options.domain && ![pair.source.type, pair.target.type].includes(options.domain)) return false;
  return true;
}

async function loadOrGenerateCorpus() {
  const existing = await fileJson(CORPUS_PATH);
  if (!options.regenerate && existing?.configVersion === GAP_SCAN_CONFIG_VERSION && existing.pairs?.length >= options.sampleSize) {
    return { ...existing, pairs: existing.pairs.filter(filterPair).slice(0, options.sampleSize) };
  }
  const edges = await loadGraphEdges();
  const direct = generateDirectCandidates(edges, GAP_SCAN_FAMILIES).filter(filterPair);
  const twoHop = generateTwoHopCandidates(edges, GAP_SCAN_TWO_HOP_TEMPLATES).filter(filterPair);
  const pairs = selectBalancedCorpus(direct, twoHop, options.sampleSize);
  if (pairs.length < options.sampleSize) {
    throw new Error(`Only ${pairs.length} unique explicit pairs were available; requested ${options.sampleSize}.`);
  }
  const corpus = {
    schemaVersion: 1,
    configVersion: GAP_SCAN_CONFIG_VERSION,
    generatedAt: new Date().toISOString(),
    source: "Neo4j explicit Wikidata-property relationships",
    requestedSampleSize: options.sampleSize,
    directPairs: pairs.filter(({ expectedSteps }) => expectedSteps === 1).length,
    twoHopPairs: pairs.filter(({ expectedSteps }) => expectedSteps === 2).length,
    pairs,
  };
  await writeJsonAtomic(CORPUS_PATH, corpus);
  return corpus;
}

const corpus = await loadOrGenerateCorpus();
console.log(`Corpus: ${corpus.pairs.length} pairs (${corpus.directPairs} direct, ${corpus.twoHopPairs} two-hop)`);
if (options.generateOnly) process.exit(0);

const corpusHash = createHash("sha256").update(JSON.stringify(corpus.pairs.map(({ id }) => id))).digest("hex").slice(0, 16);
const progressPath = join(CACHE_DIRECTORY, `progress-${corpusHash}.json`);
const priorProgress = options.fresh ? null : await fileJson(progressPath);
const resultsById = new Map((priorProgress?.results ?? []).map((result) => [result.pairId, result]));
const configuredProperties = Object.values(APPROVED_WIKIDATA_PROPERTIES);
const enabledProperties = configuredProperties.map(({ wikidataProperty }) => wikidataProperty);
const reverseEnabledProperties = configuredProperties.filter(({ reverseDiscoveryEnabled }) => reverseDiscoveryEnabled).map(({ wikidataProperty }) => wikidataProperty);

function selectedPropertiesForPair(pair) {
  const domains = [pair.source.type, pair.target.type];
  return [...new Set(domains.flatMap((domain) => {
    try {
      return selectOutgoingDiscoveryProperties(domain, configuredProperties).map(({ wikidataProperty }) => wikidataProperty);
    } catch {
      return [];
    }
  }))];
}

async function discover(pair) {
  const startedAt = performance.now();
  const url = new URL("/api/discover", options.baseUrl);
  url.search = new URLSearchParams({ fromQid: pair.source.qid, toQid: pair.target.qid, debug: "1" });
  let response;
  let body;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs), headers: { "User-Agent": "HowConnected semantic-gap-scanner/1.0" } });
      body = await response.json();
      if (![429, 503].includes(response.status) || attempt === 1) break;
      await sleep(1_500 * (attempt + 1));
    } catch (error) {
      if (attempt === 1) {
        body = { found: false, error: error instanceof Error ? error.message : "request failed" };
        response = null;
      } else {
        await sleep(1_500);
      }
    }
  }
  const runtimeMs = Math.round(performance.now() - startedAt);
  const bestPath = body?.bestPath ?? null;
  const base = {
    pairId: pair.id,
    relationshipFamily: pair.relationshipFamily,
    relationshipFamilyLabel: pair.relationshipFamilyLabel,
    expectedProperties: pair.expectedProperties,
    expectedRelationshipTypes: pair.expectedRelationshipTypes,
    expectedSteps: pair.expectedSteps,
    sourceQid: pair.source.qid,
    sourceName: pair.source.name,
    sourceDomain: pair.source.type,
    targetQid: pair.target.qid,
    targetName: pair.target.name,
    targetDomain: pair.target.type,
    productionAttemptFrequency: (pair.source.attempts ?? 0) + (pair.target.attempts ?? 0),
    found: body?.found === true,
    falseNegative: body?.found !== true,
    returnedPath: bestPath?.nodes?.map((node) => node.name ?? node.qid) ?? [],
    returnedRelationships: bestPath?.relationships?.map((relationship) => relationship.label ?? relationship.storedType) ?? [],
    qualityBand: bestPath?.qualityBand ?? null,
    score: bestPath?.score ?? null,
    runtimeMs,
    stage: body?.diagnostics?.stage ?? null,
    terminationReason: body?.diagnostics?.terminationReason ?? body?.error ?? "unknown",
    httpStatus: response?.status ?? null,
    diagnostics: body?.diagnostics ?? null,
    relevance: pair.relevance,
    complexity: pair.complexity,
    likelyFix: pair.likelyFix,
  };
  return {
    ...base,
    failureCauses: diagnoseFailure(pair, base, {
      enabledProperties,
      reverseEnabledProperties,
      selectedProperties: selectedPropertiesForPair(pair),
      missingEntityQids: [],
    }),
  };
}

let completedSinceSave = 0;
let cursor = 0;
const pending = corpus.pairs.filter((pair) => !resultsById.has(pair.id));
console.log(`Running ${pending.length} pending pairs with concurrency ${options.concurrency} and ${options.delayMs}ms pacing.`);

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
    console.log(`[${resultsById.size}/${corpus.pairs.length}] ${pair.relationshipFamily}: ${pair.source.name} → ${pair.target.name} ${result.found ? "found" : `MISS (${result.failureCauses.join("; ")})`} ${result.runtimeMs}ms`);
    if (completedSinceSave >= 5) {
      completedSinceSave = 0;
      await writeJsonAtomic(progressPath, { corpusHash, updatedAt: new Date().toISOString(), results: [...resultsById.values()] });
    }
  }
}

await Promise.all(Array.from({ length: options.concurrency }, (_, index) => worker(index)));
const results = corpus.pairs.map((pair) => resultsById.get(pair.id)).filter(Boolean);
await writeJsonAtomic(progressPath, { corpusHash, updatedAt: new Date().toISOString(), results });

const clusters = clusterFailures(results);
const summary = summarizeGapResults(results);
const runId = new Date().toISOString().replaceAll(":", "-");
const report = {
  schemaVersion: 1,
  runId,
  generatedAt: new Date().toISOString(),
  configVersion: GAP_SCAN_CONFIG_VERSION,
  corpusHash,
  options: { sampleSize: corpus.pairs.length, family: options.family, domain: options.domain, concurrency: options.concurrency, delayMs: options.delayMs },
  summary,
  clusters,
  topRecommendations: clusters.slice(0, 10).map((cluster, index) => ({ rank: index + 1, ...cluster })),
  results,
};

const previous = await fileJson(join(REPORT_DIRECTORY, "latest.json"));
const markdown = renderMarkdown(report);
await Promise.all([
  writeJsonAtomic(join(REPORT_DIRECTORY, `${runId}.json`), report),
  writeFile(join(REPORT_DIRECTORY, `${runId}.csv`), gapResultsToCsv(results), "utf8"),
  writeFile(join(REPORT_DIRECTORY, `${runId}.md`), markdown, "utf8"),
  writeJsonAtomic(join(REPORT_DIRECTORY, "latest.json"), report),
  writeFile(join(REPORT_DIRECTORY, "latest.csv"), gapResultsToCsv(results), "utf8"),
  writeFile(join(REPORT_DIRECTORY, "latest.md"), markdown, "utf8"),
]);
if (previous) await writeJsonAtomic(join(REPORT_DIRECTORY, "comparison.json"), compareGapReports(previous, report));

console.log("\nSemantic gap summary");
console.log({ ...summary, falseNegativeRate: `${(summary.falseNegativeRate * 100).toFixed(1)}%` });
console.table(report.topRecommendations.map((item) => ({ rank: item.rank, family: item.relationshipFamilyLabel, property: item.properties.join("/"), domains: `${item.sourceDomain} → ${item.targetDomain}`, cause: item.failureCause, failures: `${item.failures}/${item.tested}`, priorityScore: item.priorityScore })));
console.log(`Reports: ${REPORT_DIRECTORY}`);

function renderMarkdown(value) {
  const percent = (rate) => `${(rate * 100).toFixed(1)}%`;
  const lines = [
    "# HowConnected Accuracy Backlog",
    "",
    `Generated: ${value.generatedAt}`,
    `Pairs tested: ${value.summary.totalPairs}`,
    `False negatives: ${value.summary.falseNegatives} (${percent(value.summary.falseNegativeRate)})`,
    `Average runtime: ${value.summary.averageRuntimeMs} ms`,
    "",
    "## Top semantic gaps",
    "",
  ];
  for (const item of value.topRecommendations) {
    lines.push(`### ${item.rank}. ${item.relationshipFamilyLabel}`);
    lines.push("");
    lines.push(`- Properties: ${item.properties.join(", ")}`);
    lines.push(`- Domains: ${item.sourceDomain} → ${item.targetDomain}`);
    lines.push(`- Failure cause: ${item.failureCause}`);
    lines.push(`- Failures: ${item.failures}/${item.tested} (${percent(item.falseNegativeRate)})`);
    lines.push(`- Priority score: ${item.priorityScore}`);
    lines.push(`- Likely fix: ${item.likelyFix}`);
    lines.push(`- Complexity: ${item.complexity}`);
    for (const pair of item.representativePairs) lines.push(`  - ${pair.sourceName} (${pair.sourceQid}) → ${pair.targetName} (${pair.targetQid})`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
