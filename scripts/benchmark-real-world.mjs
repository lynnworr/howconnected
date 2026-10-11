import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REAL_WORLD_RELIABILITY_PAIRS } from "./real-world-reliability-pairs.mjs";
import {
  classifyAttempt,
  compareAttempts,
  reliabilityResultsToCsv,
  summarizeReliability,
} from "./real-world-reliability-lib.mjs";

const baseUrlArgument = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--base-url="))
  ?.slice("--base-url=".length);
const BASE_URL = baseUrlArgument ?? process.env.BENCHMARK_BASE_URL ?? "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 25_000;
const REQUEST_DELAY_MS = Number(process.env.BENCHMARK_DELAY_MS) || 250;
const REPORT_DIRECTORY = join(process.cwd(), "benchmarks", "real-world-reliability");

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function runAttempt(pair) {
  const startedAt = performance.now();
  try {
    const endpoint = new URL("/api/discover", BASE_URL);
    endpoint.search = new URLSearchParams({
      fromQid: pair.sourceQid,
      toQid: pair.targetQid,
      debug: "1",
    });
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "User-Agent": "HowConnected real-world reliability benchmark/1.0" },
    });
    const body = await response.json();
    const path = body.bestPath ?? null;
    return classifyAttempt(pair, {
      found: body.found === true,
      httpStatus: response.status,
      pathDetails: path,
      pathNames: path?.nodes?.map(({ name }) => name) ?? [],
      pathQids: path?.nodes?.map(({ qid }) => qid).filter(Boolean) ?? [],
      pathLength: path?.steps ?? null,
      qualityBand: path?.qualityBand ?? null,
      score: path?.score ?? null,
      stage: body.diagnostics?.stage ?? null,
      runtimeMs: Math.round(performance.now() - startedAt),
      timedOut: body.diagnostics?.timedOut === true,
      terminationReason: body.diagnostics?.terminationReason ?? null,
      failureCategory: body.failureCategory ?? null,
      bestRejectedPath: body.diagnostics?.bestRejectedPath ?? null,
      diagnostics: body.diagnostics
        ? {
            depthReached: body.diagnostics.depthReached,
            expandedEntities: body.diagnostics.expandedEntities,
            terminationReason: body.diagnostics.terminationReason,
            timedOut: body.diagnostics.timedOut,
            limits: body.diagnostics.limits,
            expandedBySide: body.diagnostics.expandedBySide,
            bestRejectedPath: body.diagnostics.bestRejectedPath,
          }
        : null,
    });
  } catch (error) {
    return classifyAttempt(pair, {
      found: false,
      httpStatus: null,
      pathDetails: null,
      pathNames: [],
      pathQids: [],
      pathLength: null,
      qualityBand: null,
      score: null,
      stage: null,
      runtimeMs: Math.round(performance.now() - startedAt),
      timedOut: error?.name === "TimeoutError",
      terminationReason: error?.name === "TimeoutError" ? "request_timeout" : "request_failed",
      failureCategory: error?.name === "TimeoutError" ? "timeout_or_budget" : "discovery_service",
      bestRejectedPath: null,
      diagnostics: null,
    });
  }
}

const results = [];
for (const [index, pair] of REAL_WORLD_RELIABILITY_PAIRS.entries()) {
  process.stdout.write(
    `[${index + 1}/${REAL_WORLD_RELIABILITY_PAIRS.length}] ${pair.sourceLabel} -> ${pair.targetLabel} ... `,
  );
  const first = await runAttempt(pair);
  await delay(REQUEST_DELAY_MS);
  const retry = await runAttempt(pair);
  const comparison = compareAttempts(first, retry);
  results.push({ pair, first, retry, comparison });
  console.log(
    `${first.discoveryOutcome} ${first.stage ?? "-"}/${first.runtimeMs}ms; retry ${retry.stage ?? "-"}/${retry.runtimeMs}ms${comparison.resultChanged ? " changed" : ""}`,
  );
  await delay(REQUEST_DELAY_MS);
}

const report = {
  generatedAt: new Date().toISOString(),
  baseOrigin: new URL(BASE_URL).origin,
  methodology: {
    attemptsPerPair: 2,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    privacy: "Stores only the fixed benchmark QIDs, labels, path summary, timing, and bounded technical categories; never browser URLs, search text, IP addresses, or credentials.",
  },
  summary: summarizeReliability(results),
  results,
};

await mkdir(REPORT_DIRECTORY, { recursive: true });
const timestamp = report.generatedAt.replaceAll(":", "-");
const json = `${JSON.stringify(report, null, 2)}\n`;
const csv = reliabilityResultsToCsv(results);
await Promise.all([
  writeFile(join(REPORT_DIRECTORY, `${timestamp}.json`), json),
  writeFile(join(REPORT_DIRECTORY, `${timestamp}.csv`), csv),
  writeFile(join(REPORT_DIRECTORY, "latest.json"), json),
  writeFile(join(REPORT_DIRECTORY, "latest.csv"), csv),
]);

console.log("\nSummary:", report.summary);
console.log(`Reports: ${REPORT_DIRECTORY}`);
