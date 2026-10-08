import "server-only";

import neo4j from "neo4j-driver";
import { DISCOVERY_CONFIG } from "@/lib/discovery-config";
import {
  runDiscovery,
  type BridgeSignals,
  type DiscoveryEntity,
  type FrontierCandidate,
} from "@/lib/discovery-engine";
import { ingestWikidataEntityWithMetadata } from "@/lib/ingest-wikidata";
import { getNeo4jDriver } from "@/lib/neo4j";
import { findRankedPathsByQids } from "@/lib/ranked-paths";
import { REVERSE_DISCOVERY_VERSION } from "@/lib/wikidata-incoming";
import { findWikipediaBridgeCandidates } from "@/lib/wikipedia-bridges";

type EntityRecord = {
  qid?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
};

async function getEntity(qid: string): Promise<DiscoveryEntity | null> {
  const result = await getNeo4jDriver().executeQuery(
    `
      MATCH (entity:Entity {qid: $qid})
      RETURN entity
      LIMIT 1
    `,
    { qid },
  );
  const properties = result.records[0]?.get("entity")?.properties as
    | EntityRecord
    | undefined;

  if (
    !properties ||
    typeof properties.qid !== "string" ||
    typeof properties.name !== "string"
  ) {
    return null;
  }

  return {
    qid: properties.qid,
    name: properties.name,
    description:
      typeof properties.description === "string" ? properties.description : "",
    type: typeof properties.type === "string" ? properties.type : "entity",
  };
}

async function getExpansionState(qid: string) {
  const result = await getNeo4jDriver().executeQuery(
    `
      OPTIONAL MATCH (entity:Entity {qid: $qid})
      RETURN entity IS NOT NULL AS exists,
             (coalesce(entity.wikidataExpanded, false)
               AND coalesce(entity.wikidataReverseExpanded, false)
               AND coalesce(entity.wikidataReverseExpansionVersion, 0) >= $reverseDiscoveryVersion) AS expanded
    `,
    { qid, reverseDiscoveryVersion: REVERSE_DISCOVERY_VERSION },
  );
  const record = result.records[0];

  return {
    exists: record?.get("exists") === true,
    expanded: record?.get("expanded") === true,
  };
}

async function getFrontier(qid: string): Promise<FrontierCandidate[]> {
  const result = await getNeo4jDriver().executeQuery(
    `
      MATCH (origin:Entity {qid: $qid})-[relationship]-(target:Entity)
      WHERE relationship.wikidataProperty IS NOT NULL
        AND coalesce(relationship.traversable, false) = true
        AND target <> origin
      RETURN target.qid AS qid,
             target.name AS name,
             coalesce(relationship.weight, 2.0) AS relationshipWeight,
             coalesce(target.type, "entity") AS type,
             coalesce(target.description, "") AS description
    `,
    { qid },
  );

  return result.records.flatMap((record): FrontierCandidate[] => {
    const targetQid = record.get("qid");
    const relationshipWeight = record.get("relationshipWeight");

    if (typeof targetQid !== "string") return [];

    return [
      {
        qid: targetQid,
        name:
          typeof record.get("name") === "string"
            ? (record.get("name") as string)
            : targetQid,
        relationshipWeight:
          typeof relationshipWeight === "number"
            ? relationshipWeight
            : Number(relationshipWeight),
        type: record.get("type") as string,
        description: record.get("description") as string,
      },
    ];
  });
}

async function getBridgeSignals(
  candidates: Array<{ qid: string; side: "source" | "target" }>,
  sourceSeenQids: string[],
  targetSeenQids: string[],
): Promise<ReadonlyMap<string, BridgeSignals>> {
  if (candidates.length === 0) return new Map();

  const result = await getNeo4jDriver().executeQuery(
    `
      UNWIND $candidates AS input
      MATCH (candidate:Entity {qid: input.qid})
      OPTIONAL MATCH (candidate)-[relationship]-()
      WITH input, candidate, count(relationship) AS degree
      RETURN input.qid AS qid,
             input.side AS side,
             degree,
             EXISTS {
               MATCH (candidate)-[bridge]-(opposite:Entity)
               WHERE coalesce(bridge.traversable, false) = true
                 AND (
                   (input.side = "source" AND opposite.qid IN $targetSeenQids)
                   OR
                   (input.side = "target" AND opposite.qid IN $sourceSeenQids)
                 )
             } AS directToOpposite
    `,
    { candidates, sourceSeenQids, targetSeenQids },
  );

  return new Map(
    result.records.map((record): [string, BridgeSignals] => {
      const degree = record.get("degree");
      const side = record.get("side") as "source" | "target";
      const qid = record.get("qid") as string;
      return [
        `${side}:${qid}`,
        {
          degree: neo4j.isInt(degree) ? degree.toNumber() : Number(degree),
          directToOpposite: record.get("directToOpposite") === true,
        },
      ];
    }),
  );
}

export function discoverConnection(fromQid: string, toQid: string) {
  return runDiscovery(
    fromQid,
    toQid,
    {
      findPaths: findRankedPathsByQids,
      getEntity,
      getExpansionState,
      getFrontier,
      getBridgeSignals,
      getAssistedCandidates: (sourceQid, targetQid, perSideCap, deadlineMs) =>
        findWikipediaBridgeCandidates(sourceQid, targetQid, {
          perSideCap,
          deadlineMs,
        }),
      ingest: async (qid, limits) => {
        const result = await ingestWikidataEntityWithMetadata(qid, {
          maxNewEntities: limits.maxNewEntities,
          maxRelationships: limits.maxNewRelationships,
          deadlineMs: limits.deadlineMs,
        });

        return {
          entitiesAdded:
            (result.sourceEntityAdded ?? 0) + result.linkedEntitiesAdded,
          relationshipsAdded: result.relationshipsAdded,
          relationshipsDiscovered: result.relationshipsDiscovered,
          reverseLookupComplete: result.reverseLookupComplete,
        };
      },
    },
    DISCOVERY_CONFIG,
  );
}
