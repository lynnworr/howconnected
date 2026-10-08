import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOMAIN_BENCHMARK_PAIRS } from "./domain-benchmark-pairs.mjs";
import {
  classifySemanticQuality,
  detectSuspiciousPatterns,
  diagnoseFailure,
  rankDomains,
  resultsToCsv,
  summarizeResults,
} from "./domain-benchmark-lib.mjs";

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 20_000;
const REPORT_DIRECTORY = join(process.cwd(), "benchmarks", "domain-audit");
const RESUME_TRANSIENT_FAILURES = process.env.BENCHMARK_RESUME === "1";
const REQUEST_DELAY_MS = Number(process.env.BENCHMARK_DELAY_MS) || 500;

const pairKey = (pair) => `${pair.domain}:${pair.sourceQid}:${pair.targetQid}`;
const isTransientFailure = (result) =>
  result &&
  !result.found &&
  ((result.httpStatus ?? 0) >= 500 || result.httpStatus === null);

async function loadPreviousResults() {
  if (!RESUME_TRANSIENT_FAILURES) return new Map();
  try {
    const report = JSON.parse(
      await readFile(join(REPORT_DIRECTORY, "latest.json"), "utf8"),
    );
    return new Map(report.results.map((result) => [pairKey(result), result]));
  } catch {
    return new Map();
  }
}

async function runPair(pair, index) {
  const startedAt = performance.now();
  process.stdout.write(
    `[${index + 1}/${DOMAIN_BENCHMARK_PAIRS.length}] ${pair.domain}: ${pair.sourceLabel} -> ${pair.targetLabel} ... `,
  );
  try {
    const url = new URL("/api/discover", BASE_URL);
    url.search = new URLSearchParams({
      fromQid: pair.sourceQid,
      toQid: pair.targetQid,
      debug: "1",
    });
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json();
    const runtimeMs = Math.round(performance.now() - startedAt);
    const path = body.bestPath ?? null;
    const suspiciousPatterns = detectSuspiciousPatterns(path);
    const baseResult = {
      ...pair,
      found: body.found === true,
      httpStatus: response.status,
      path: path?.nodes?.map((node) => node.name) ?? [],
      pathDetails: path,
      qualityBand: path?.qualityBand ?? null,
      score: path?.score ?? null,
      stage: body.diagnostics?.stage ?? null,
      runtimeMs,
      timedOut: body.diagnostics?.timedOut === true,
      terminationReason:
        body.diagnostics?.terminationReason ?? body.error ?? "unknown",
      suspiciousPatterns,
      suspicious: suspiciousPatterns.length > 0,
      sourceType: body.source?.type ?? null,
      targetType: body.target?.type ?? null,
      depthReached: body.diagnostics?.depthReached ?? null,
      expandedEntities: body.diagnostics?.expandedEntities ?? null,
      bestRejectedPath: body.diagnostics?.bestRejectedPath ?? null,
    };
    const result = {
      ...baseResult,
      semanticQuality: classifySemanticQuality({
        found: baseResult.found,
        path,
        suspiciousPatterns,
      }),
      failureCategories: diagnoseFailure(baseResult),
    };
    console.log(
      `${result.found ? "found" : "miss"} (${result.semanticQuality}, ${runtimeMs}ms)`,
    );
    return result;
  } catch (error) {
    const runtimeMs = Math.round(performance.now() - startedAt);
    const result = {
      ...pair,
      found: false,
      httpStatus: null,
      path: [],
      pathDetails: null,
      qualityBand: null,
      score: null,
      semanticQuality: "bad",
      suspicious: false,
      suspiciousPatterns: [],
      stage: null,
      runtimeMs,
      timedOut: error?.name === "TimeoutError",
      terminationReason: error instanceof Error ? error.message : "request failed",
      failureCategories: ["discovery depth/budget issue"],
    };
    console.log(`error (${runtimeMs}ms): ${result.terminationReason}`);
    return result;
  }
}

const previousResults = await loadPreviousResults();
const results = [];
for (const [index, pair] of DOMAIN_BENCHMARK_PAIRS.entries()) {
  const previous = previousResults.get(pairKey(pair));
  if (RESUME_TRANSIENT_FAILURES && previous && !isTransientFailure(previous)) {
    results.push(previous);
    continue;
  }
  results.push(await runPair(pair, index));
  if (REQUEST_DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
}

const auditedResults = results.map((result) => ({
  ...result,
  ...(() => {
    const suspiciousPatterns = detectSuspiciousPatterns(result.pathDetails);
    return {
      suspiciousPatterns,
      suspicious: suspiciousPatterns.length > 0,
      semanticQuality: classifySemanticQuality({
        found: result.found,
        path: result.pathDetails,
        suspiciousPatterns,
      }),
      failureCategories: diagnoseFailure(result),
    };
  })(),
}));
const domainRanking = rankDomains(auditedResults);
const failureCategoryCounts = Object.fromEntries(
  [...new Set(auditedResults.flatMap(({ failureCategories }) => failureCategories))]
    .map((category) => [
      category,
      auditedResults.filter(({ failureCategories }) => failureCategories.includes(category)).length,
    ])
    .sort((left, right) => right[1] - left[1]),
);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  overall: summarizeResults(auditedResults),
  domainRanking,
  failureCategoryCounts,
  results: auditedResults,
};

await mkdir(REPORT_DIRECTORY, { recursive: true });
const timestamp = report.generatedAt.replaceAll(":", "-");
const json = `${JSON.stringify(report, null, 2)}\n`;
const csv = resultsToCsv(auditedResults);
await Promise.all([
  writeFile(join(REPORT_DIRECTORY, `${timestamp}.json`), json),
  writeFile(join(REPORT_DIRECTORY, `${timestamp}.csv`), csv),
  writeFile(join(REPORT_DIRECTORY, "latest.json"), json),
  writeFile(join(REPORT_DIRECTORY, "latest.csv"), csv),
]);

const percent = (value) => `${(value * 100).toFixed(1)}%`;
console.log("\nDomain ranking (good semantic rate, then success rate):");
console.table(
  domainRanking.map((summary, index) => ({
    rank: index + 1,
    domain: summary.domain,
    pairs: summary.totalPairs,
    success: percent(summary.successRate),
    good: percent(summary.semanticQualityRates.good),
    borderline: percent(summary.semanticQualityRates.borderline),
    bad: percent(summary.semanticQualityRates.bad),
    suspicious: percent(summary.suspiciousPathRate),
    timeout: percent(summary.timeoutRate),
    averageMs: summary.averageRuntimeMs,
    medianMs: summary.medianRuntimeMs,
  })),
);
console.log("Overall:", {
  pairs: report.overall.totalPairs,
  success: percent(report.overall.successRate),
  good: percent(report.overall.semanticQualityRates.good),
  borderline: percent(report.overall.semanticQualityRates.borderline),
  bad: percent(report.overall.semanticQualityRates.bad),
  suspicious: percent(report.overall.suspiciousPathRate),
  timeout: percent(report.overall.timeoutRate),
  averageMs: report.overall.averageRuntimeMs,
  medianMs: report.overall.medianRuntimeMs,
});
console.log("Failure categories:", failureCategoryCounts);
console.log(`Reports: ${REPORT_DIRECTORY}`);
