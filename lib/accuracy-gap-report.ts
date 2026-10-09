import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isValidQid } from "@/lib/wikidata-id";

export type CoverageGapPair = {
  sourceQid: string;
  sourceName: string;
  targetQid: string;
  targetName: string;
};

export type CoverageGapCluster = {
  id: string;
  relationshipFamilyLabel: string;
  properties: string[];
  sourceDomain: string;
  targetDomain: string;
  failureCause: string;
  failures: number;
  tested: number;
  falseNegativeRate: number;
  priorityScore: number;
  representativePairs: CoverageGapPair[];
};

export type CoverageGapSummary = {
  generatedAt: string;
  totalPairs: number;
  falseNegatives: number;
  falseNegativeRate: number;
  topClusters: CoverageGapCluster[];
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanPair(value: unknown): CoverageGapPair | null {
  const item = record(value);
  const sourceQid = typeof item?.sourceQid === "string" ? item.sourceQid : "";
  const targetQid = typeof item?.targetQid === "string" ? item.targetQid : "";
  if (!isValidQid(sourceQid) || !isValidQid(targetQid)) return null;
  return {
    sourceQid,
    sourceName: typeof item?.sourceName === "string" ? item.sourceName : sourceQid,
    targetQid,
    targetName: typeof item?.targetName === "string" ? item.targetName : targetQid,
  };
}

function cleanCluster(value: unknown): CoverageGapCluster | null {
  const item = record(value);
  const failures = finiteNumber(item?.failures);
  const tested = finiteNumber(item?.tested);
  const rate = finiteNumber(item?.falseNegativeRate);
  const priority = finiteNumber(item?.priorityScore);
  if (!item || failures === null || tested === null || rate === null || priority === null) return null;
  return {
    id: typeof item.id === "string" ? item.id : `${item.relationshipFamilyLabel}-${item.failureCause}`,
    relationshipFamilyLabel: typeof item.relationshipFamilyLabel === "string" ? item.relationshipFamilyLabel : "Unknown family",
    properties: Array.isArray(item.properties) ? item.properties.filter((property): property is string => typeof property === "string").slice(0, 6) : [],
    sourceDomain: typeof item.sourceDomain === "string" ? item.sourceDomain : "entity",
    targetDomain: typeof item.targetDomain === "string" ? item.targetDomain : "entity",
    failureCause: typeof item.failureCause === "string" ? item.failureCause : "unknown",
    failures,
    tested,
    falseNegativeRate: rate,
    priorityScore: priority,
    representativePairs: Array.isArray(item.representativePairs) ? item.representativePairs.flatMap((pair) => {
      const cleaned = cleanPair(pair);
      return cleaned ? [cleaned] : [];
    }).slice(0, 3) : [],
  };
}

export async function getLatestCoverageGapSummary(): Promise<CoverageGapSummary | null> {
  try {
    const path = join(process.cwd(), "benchmarks", "gap-scan", "reports", "latest.json");
    const report = record(JSON.parse(await readFile(path, "utf8")));
    const summary = record(report?.summary);
    const totalPairs = finiteNumber(summary?.totalPairs);
    const falseNegatives = finiteNumber(summary?.falseNegatives);
    const falseNegativeRate = finiteNumber(summary?.falseNegativeRate);
    if (!report || typeof report.generatedAt !== "string" || totalPairs === null || falseNegatives === null || falseNegativeRate === null) return null;
    return {
      generatedAt: report.generatedAt,
      totalPairs,
      falseNegatives,
      falseNegativeRate,
      topClusters: Array.isArray(report.topRecommendations) ? report.topRecommendations.flatMap((cluster) => {
        const cleaned = cleanCluster(cluster);
        return cleaned ? [cleaned] : [];
      }).slice(0, 10) : [],
    };
  } catch {
    return null;
  }
}
