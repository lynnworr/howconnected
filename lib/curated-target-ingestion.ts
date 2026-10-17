import "server-only";

import neo4j, { type ManagedTransaction } from "neo4j-driver";
import {
  createCuratedTargetPlan,
  executeCuratedTargetPlan,
  getNonDeprecatedClaimTargetQids,
  selectVerifiedWikidataStatement,
  type CuratedEntityInput,
  type CuratedRelationshipInput,
  type CuratedTargetPlan,
  type CuratedTargetState,
  type CuratedTargetWriter,
  type CuratedWriteResult,
} from "@/lib/curated-target-ingestion-core";
import {
  classifyEntityDomain,
  hasKnownEntityDomain,
  isEntityDomain,
} from "@/lib/entity-domain";
import { getNeo4jDriver } from "@/lib/neo4j";
import { assertNeo4jWritesAllowed } from "@/lib/neo4j-write-maintenance";
import {
  APPROVED_WIKIDATA_PROPERTIES,
  getConfiguredRelationshipWeight,
} from "@/lib/wikidata-properties";
import {
  fetchWikidataEntities,
  isValidQid,
  type WikidataEntity,
} from "@/lib/wikidata";
import { resolveWikidataTypeHierarchy } from "@/lib/wikidata-type-hierarchy";

export type CuratedTargetRequest = {
  sourceQid: string;
  targetQid: string;
  propertyId: string;
  deadlineMs?: number;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entityClaimQids(entity: WikidataEntity, propertyId: string): string[] {
  return getNonDeprecatedClaimTargetQids(entity.claims[propertyId] ?? []);
}

async function classify(entity: WikidataEntity, deadlineMs?: number) {
  const instanceOfQids = entityClaimQids(entity, "P31");
  const ancestorQids = !hasKnownEntityDomain(instanceOfQids)
    ? await resolveWikidataTypeHierarchy(instanceOfQids, {
        fetchEntities: fetchWikidataEntities,
        deadlineMs,
      })
    : instanceOfQids;
  return classifyEntityDomain({
    instanceOfQids,
    ancestorQids,
    name: entity.name,
    description: entity.description,
  });
}

function integer(value: unknown): number {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

function readStateRecord(record: { get(key: string): unknown }): CuratedTargetState {
  const relationships = record.get("relationships");
  return {
    totalNodes: integer(record.get("totalNodes")),
    totalRelationships: integer(record.get("totalRelationships")),
    sourceExists: record.get("sourceExists") === true,
    targetExists: record.get("targetExists") === true,
    relationships: Array.isArray(relationships)
      ? relationships.filter(isJsonObject)
      : [],
  };
}

const TARGET_STATE_QUERY = `
  MATCH (node)
  WITH count(node) AS totalNodes
  OPTIONAL MATCH ()-[allRelationships]->()
  WITH totalNodes, count(allRelationships) AS totalRelationships
  OPTIONAL MATCH (source:Entity {qid: $sourceQid})
  OPTIONAL MATCH (target:Entity {qid: $targetQid})
  OPTIONAL MATCH (source)-[relationship]->(target)
  WHERE type(relationship) = $relationshipType
  RETURN totalNodes,
         totalRelationships,
         source IS NOT NULL AS sourceExists,
         target IS NOT NULL AS targetExists,
         [item IN collect(relationship) WHERE item IS NOT NULL | properties(item)] AS relationships
`;

async function transactionWriter(
  transaction: ManagedTransaction,
  plan: CuratedTargetPlan,
): Promise<CuratedTargetWriter> {
  return {
    async readTargetState() {
      const result = await transaction.run(TARGET_STATE_QUERY, {
        sourceQid: plan.source.qid,
        targetQid: plan.target.qid,
        relationshipType: plan.relationship.relationshipType,
      });
      const record = result.records[0];
      if (!record) throw new Error("Unable to read curated-target database state.");
      return readStateRecord(record);
    },
    async createMissingNodes(source, target) {
      const result = await transaction.run(
        `
          UNWIND $entities AS entity
          MERGE (node:Entity {qid: entity.qid})
          ON CREATE SET node.name = entity.name,
                        node.description = entity.description,
                        node.type = entity.type
        `,
        { entities: [source, target] },
      );
      return result.summary.counters.updates().nodesCreated;
    },
    async createMissingRelationship(sourceQid, targetQid, relationship) {
      const result = await transaction.run(
        `
          MATCH (source:Entity {qid: $sourceQid})
          MATCH (target:Entity {qid: $targetQid})
          MERGE (source)-[edge:${relationship.relationshipType}]->(target)
          ON CREATE SET edge.wikidataProperty = $wikidataProperty,
                        edge.label = $label,
                        edge.reverseLabel = $reverseLabel,
                        edge.weight = $weight,
                        edge.traversable = $traversable
        `,
        {
          sourceQid,
          targetQid,
          wikidataProperty: relationship.propertyId,
          label: relationship.label,
          reverseLabel: relationship.reverseLabel,
          weight: relationship.weight,
          traversable: relationship.traversable,
        },
      );
      return result.summary.counters.updates().relationshipsCreated;
    },
  };
}

async function readTargetState(
  request: CuratedTargetRequest,
  relationshipType: string,
): Promise<CuratedTargetState> {
  const result = await getNeo4jDriver().executeQuery(
    TARGET_STATE_QUERY,
    {
      sourceQid: request.sourceQid,
      targetQid: request.targetQid,
      relationshipType,
    },
    { routing: neo4j.routing.READ },
  );
  const record = result.records[0];
  if (!record) throw new Error("Unable to read curated-target database state.");
  return readStateRecord(record);
}

export async function prepareCuratedTargetIngestion(
  request: CuratedTargetRequest,
): Promise<CuratedTargetPlan> {
  if (!isValidQid(request.sourceQid) || !isValidQid(request.targetQid)) {
    throw new Error("Curated-target ingestion requires valid source and target QIDs.");
  }
  if (request.sourceQid === request.targetQid) {
    throw new Error("Curated-target ingestion requires two distinct QIDs.");
  }
  const property = APPROVED_WIKIDATA_PROPERTIES[
    request.propertyId as keyof typeof APPROVED_WIKIDATA_PROPERTIES
  ];
  if (!property) {
    throw new Error("Curated-target ingestion requires an allowlisted Wikidata property.");
  }
  const entities = await fetchWikidataEntities([request.sourceQid, request.targetQid]);
  const source = entities.find(({ qid }) => qid === request.sourceQid);
  const target = entities.find(({ qid }) => qid === request.targetQid);
  if (!source || !target) throw new Error("Wikidata did not return both curated entities.");

  const [sourceType, targetType] = await Promise.all([
    classify(source, request.deadlineMs),
    classify(target, request.deadlineMs),
  ]);
  const statement = selectVerifiedWikidataStatement(
    source.claims[request.propertyId] ?? [],
    request.targetQid,
  );
  const relationship: CuratedRelationshipInput = {
    propertyId: property.wikidataProperty,
    relationshipType: property.relationship,
    label: property.label,
    reverseLabel: property.reverseLabel,
    weight: getConfiguredRelationshipWeight(property, sourceType),
    traversable: property.traversable,
    ...statement,
  };
  const toInput = (entity: WikidataEntity, type: string): CuratedEntityInput => ({
    qid: entity.qid,
    name: entity.name,
    description: entity.description,
    type,
  });
  const state = await readTargetState(request, property.relationship);
  return createCuratedTargetPlan({
    source: toInput(source, sourceType),
    target: toInput(target, targetType),
    relationship,
    state,
  });
}

export async function executeCuratedTargetIngestion(
  reviewedPlan: CuratedTargetPlan,
): Promise<CuratedWriteResult> {
  assertNeo4jWritesAllowed();
  const property = APPROVED_WIKIDATA_PROPERTIES[
    reviewedPlan.relationship.propertyId as keyof typeof APPROVED_WIKIDATA_PROPERTIES
  ];
  if (
    reviewedPlan.mode !== "curated-target" ||
    !isValidQid(reviewedPlan.source.qid) ||
    !isValidQid(reviewedPlan.target.qid) ||
    reviewedPlan.source.qid === reviewedPlan.target.qid ||
    !isEntityDomain(reviewedPlan.source.type) ||
    !property ||
    property.relationship !== reviewedPlan.relationship.relationshipType ||
    property.label !== reviewedPlan.relationship.label ||
    property.reverseLabel !== reviewedPlan.relationship.reverseLabel ||
    property.traversable !== reviewedPlan.relationship.traversable ||
    getConfiguredRelationshipWeight(property, reviewedPlan.source.type) !==
      reviewedPlan.relationship.weight
  ) {
    throw new Error("The reviewed curated-target plan no longer matches the ingestion allowlist.");
  }
  const session = getNeo4jDriver().session();
  try {
    return await executeCuratedTargetPlan(reviewedPlan, {
      executeWrite: (work) => session.executeWrite(async (transaction) =>
        work(await transactionWriter(transaction, reviewedPlan))),
    });
  } finally {
    await session.close();
  }
}
