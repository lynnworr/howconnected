import "server-only";

import {
  APPROVED_WIKIDATA_PROPERTIES,
  MAX_LINKED_ENTITIES_PER_PROPERTY,
  MAX_RELATIONSHIPS_PER_INGESTION,
  WIKIDATA_EXPANSION_VERSION,
  getConfiguredRelationshipWeight,
  type WikidataPropertyConfig,
} from "@/lib/wikidata-properties";
import {
  fetchWikidataEntity,
  fetchWikidataEntities,
  fetchWikidataEntitySummaries,
  isValidQid,
  type WikidataEntity,
  type WikidataEntitySummary,
} from "@/lib/wikidata";
import { getNeo4jDriver } from "@/lib/neo4j";
import {
  classifyEntityDomain,
  hasKnownEntityDomain,
  type EntityDomain,
} from "@/lib/entity-domain";
import { selectOutgoingDiscoveryProperties } from "@/lib/discovery-policy";
import { resolveWikidataTypeHierarchy } from "@/lib/wikidata-type-hierarchy";
import { prioritizeClaimTargets } from "@/lib/wikidata-claim-routing";
import {
  fetchIncomingWikidataEntities,
  REVERSE_DISCOVERY_VERSION,
  selectReverseDiscoveryProperties,
} from "@/lib/wikidata-incoming";

type JsonObject = Record<string, unknown>;

type RelationshipCandidate = {
  property: WikidataPropertyConfig;
  targetQid: string;
  direction: "outgoing" | "incoming";
};

export type IngestionPropertyResult = {
  wikidataProperty: string;
  label: string;
  relationship: string;
  linkedEntities: number;
};

export type WikidataIngestionResult = {
  source: {
    qid: string;
    name: string;
    description: string;
    type: string;
  };
  sourceEntityAdded: number;
  linkedEntitiesAdded: number;
  relationshipsAdded: number;
  relationshipsDiscovered: number;
  reverseLookupComplete: boolean;
  propertiesFound: IngestionPropertyResult[];
  timings: WikidataIngestionTimings;
};

export type WikidataIngestionTimings = {
  entityFetchMs: number;
  hierarchyMs: number;
  reverseLookupMs: number;
  targetSummaryMs: number;
  neo4jWriteMs: number;
  totalMs: number;
};

export type WikidataIngestionOptions = {
  maxNewEntities?: number;
  maxRelationships?: number;
  deadlineMs?: number;
  priorityTargetQid?: string;
  resolveTypeHierarchy?: boolean;
  directTargetOnly?: boolean;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getEntityQids(claims: readonly unknown[]): string[] {
  const qids: string[] = [];

  for (const claim of claims) {
    if (!isJsonObject(claim) || !isJsonObject(claim.mainsnak)) {
      continue;
    }

    const snak = claim.mainsnak;
    if (
      snak.snaktype !== "value" ||
      snak.datatype !== "wikibase-item" ||
      !isJsonObject(snak.datavalue) ||
      !isJsonObject(snak.datavalue.value)
    ) {
      continue;
    }

    const value = snak.datavalue.value;
    if (
      value["entity-type"] === "item" &&
      typeof value.id === "string" &&
      isValidQid(value.id)
    ) {
      qids.push(value.id);
    }
  }

  return [...new Set(qids)];
}

function collectRelationships(
  entity: WikidataEntity,
  domain: EntityDomain,
  options: WikidataIngestionOptions,
): {
  candidates: RelationshipCandidate[];
  propertiesFound: IngestionPropertyResult[];
} {
  const candidates: RelationshipCandidate[] = [];
  const propertiesFound: IngestionPropertyResult[] = [];
  const relationshipLimit = Math.min(
    options.maxRelationships ?? MAX_RELATIONSHIPS_PER_INGESTION,
    MAX_RELATIONSHIPS_PER_INGESTION,
    options.maxNewEntities === undefined
      ? MAX_RELATIONSHIPS_PER_INGESTION
      : Math.max(0, options.maxNewEntities - 1),
  );

  const approvedProperties = Object.values(APPROVED_WIKIDATA_PROPERTIES);
  const explicitTargetPropertyIds = options.priorityTargetQid
    ? approvedProperties.flatMap((property) =>
        getEntityQids(entity.claims[property.wikidataProperty] ?? []).includes(
          options.priorityTargetQid as string,
        )
          ? [property.wikidataProperty]
          : [],
      )
    : [];
  const selectedProperties = selectOutgoingDiscoveryProperties(
    domain,
    approvedProperties,
    {
      availablePropertyIds: Object.keys(entity.claims),
      explicitTargetPropertyIds,
    },
  ).sort((left, right) => {
    if (!options.priorityTargetQid) return 0;
    const hasPriorityTarget = (property: WikidataPropertyConfig) =>
      getEntityQids(entity.claims[property.wikidataProperty] ?? [])
        .includes(options.priorityTargetQid as string);
    return Number(hasPriorityTarget(right)) - Number(hasPriorityTarget(left));
  });

  for (const property of selectedProperties) {
    const remaining = relationshipLimit - candidates.length;
    if (remaining === 0) break;

    const targetQids = prioritizeClaimTargets(getEntityQids(
      entity.claims[property.wikidataProperty] ?? [],
    ).filter((targetQid) =>
      targetQid !== entity.qid &&
      (!options.directTargetOnly || targetQid === options.priorityTargetQid)
    ), options.priorityTargetQid).slice(
      0,
      Math.min(
        property.maxFanout ?? MAX_LINKED_ENTITIES_PER_PROPERTY,
        remaining,
      ),
    );

    if (targetQids.length === 0) continue;

    candidates.push(
      ...targetQids.map((targetQid) => ({
        property,
        targetQid,
        direction: "outgoing" as const,
      })),
    );
    propertiesFound.push({
      wikidataProperty: property.wikidataProperty,
      label: property.label,
      relationship: property.relationship,
      linkedEntities: targetQids.length,
    });
  }

  return { candidates, propertiesFound };
}

function groupRelationships(candidates: RelationshipCandidate[]) {
  const groups = new Map<string, RelationshipCandidate[]>();

  for (const candidate of candidates) {
    const key = `${candidate.direction}:${candidate.property.wikidataProperty}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  return groups.values();
}

export async function ingestWikidataEntityWithMetadata(
  qid: string,
  options: WikidataIngestionOptions = {},
): Promise<WikidataIngestionResult> {
  const startedAt = Date.now();
  const entity = await fetchWikidataEntity(qid);
  const entityFetchedAt = Date.now();
  const instanceOfQids = getEntityQids(entity.claims.P31 ?? []);
  const hierarchyStartedAt = Date.now();
  const ancestorQids = options.resolveTypeHierarchy && !hasKnownEntityDomain(instanceOfQids)
    ? await resolveWikidataTypeHierarchy(instanceOfQids, {
        fetchEntities: fetchWikidataEntities,
        deadlineMs: options.deadlineMs,
      })
    : instanceOfQids;
  const hierarchyFinishedAt = Date.now();
  const sourceType = classifyEntityDomain({
    instanceOfQids,
    ancestorQids,
    name: entity.name,
    description: entity.description,
  });
  const { candidates: outgoingCandidates, propertiesFound } =
    collectRelationships(entity, sourceType, options);
  const candidateLimit = Math.min(
    options.maxRelationships ?? MAX_RELATIONSHIPS_PER_INGESTION,
    MAX_RELATIONSHIPS_PER_INGESTION,
    options.maxNewEntities === undefined
      ? MAX_RELATIONSHIPS_PER_INGESTION
      : Math.max(0, options.maxNewEntities - 1),
  );
  const incomingCandidates: RelationshipCandidate[] = [];
  let reverseLookupComplete = true;
  const reverseLookupStartedAt = Date.now();

  for (const property of options.directTargetOnly ? [] : selectReverseDiscoveryProperties(
    { type: sourceType, description: entity.description },
    Object.values(APPROVED_WIKIDATA_PROPERTIES),
  )) {
    if (options.deadlineMs !== undefined && Date.now() >= options.deadlineMs - 250) {
      reverseLookupComplete = false;
      break;
    }
    const remaining = candidateLimit - outgoingCandidates.length - incomingCandidates.length;
    if (remaining <= 0) break;

    const lookup = await fetchIncomingWikidataEntities(entity.qid, property);
    if (lookup.status !== "ok") {
      reverseLookupComplete = false;
      continue;
    }

    const incomingQids = lookup.qids
      .filter((incomingQid) => incomingQid !== entity.qid)
      .slice(0, remaining);
    if (incomingQids.length === 0) continue;

    incomingCandidates.push(
      ...incomingQids.map((targetQid) => ({
        property,
        targetQid,
        direction: "incoming" as const,
      })),
    );
    propertiesFound.push({
      wikidataProperty: property.wikidataProperty,
      label: property.reverseDiscoveryLabel ?? property.reverseLabel,
      relationship: property.relationship,
      linkedEntities: incomingQids.length,
    });
  }
  const reverseLookupFinishedAt = Date.now();

  const candidates = [...outgoingCandidates, ...incomingCandidates];
  const targetSummaryStartedAt = Date.now();
  const targetSummaries = (await fetchWikidataEntitySummaries(
    candidates.map((candidate) => candidate.targetQid),
  )).map((summary) => ({
    ...summary,
    type: classifyEntityDomain({
      name: summary.name,
      description: summary.description,
    }),
  }));
  const targetSummaryFinishedAt = Date.now();
  const driver = getNeo4jDriver();
  const session = driver.session();
  const neo4jWriteStartedAt = Date.now();

  try {
    const counts = await session.executeWrite(async (transaction) => {
      const sourceResult = await transaction.run(
        `
          MERGE (source:Entity {qid: $qid})
          SET source.name = CASE
                WHEN source.name IS NULL OR source.name = source.qid THEN $name
                ELSE source.name
              END,
              source.description = CASE
                WHEN $description <> "" THEN $description
                ELSE coalesce(source.description, "")
              END,
              source.type = CASE
                WHEN $type <> "entity" THEN $type
                ELSE coalesce(source.type, "entity")
              END,
              source.wikidataExpanded = true,
              source.wikidataExpandedAt = datetime(),
              source.wikidataExpansionVersion = $expansionVersion,
              source.wikidataReverseExpanded = CASE
                WHEN $reverseLookupComplete THEN true
                ELSE coalesce(source.wikidataReverseExpanded, false)
              END,
              source.wikidataReverseExpandedAt = CASE
                WHEN $reverseLookupComplete THEN datetime()
                ELSE source.wikidataReverseExpandedAt
              END,
              source.wikidataReverseExpansionVersion = CASE
                WHEN $reverseLookupComplete THEN $reverseDiscoveryVersion
                ELSE coalesce(source.wikidataReverseExpansionVersion, 0)
              END
        `,
        {
          qid: entity.qid,
          name: entity.name,
          description: entity.description,
          type: sourceType,
          reverseLookupComplete,
          reverseDiscoveryVersion: REVERSE_DISCOVERY_VERSION,
          expansionVersion: WIKIDATA_EXPANSION_VERSION,
        },
      );

      const targetResult = await transaction.run(
        `
          UNWIND $targets AS entity
          MERGE (target:Entity {qid: entity.qid})
          ON CREATE SET target.name = entity.name,
                        target.description = entity.description,
                        target.type = entity.type
          ON MATCH SET target.name = CASE
                         WHEN target.name IS NULL OR target.name = target.qid
                           THEN entity.name
                         ELSE target.name
                       END,
                       target.description = CASE
                         WHEN entity.description <> "" THEN entity.description
                         ELSE coalesce(target.description, "")
                       END,
                       target.type = CASE
                         WHEN coalesce(target.type, "entity") = "entity"
                           AND entity.type <> "entity" THEN entity.type
                         ELSE coalesce(target.type, entity.type)
                       END
        `,
        {
          targets: targetSummaries satisfies Array<
            WikidataEntitySummary & { type: EntityDomain }
          >,
        },
      );

      let relationshipsAdded = 0;

      for (const group of groupRelationships(candidates)) {
        const property = group[0].property;
        if (!/^[A-Z][A-Z0-9_]*$/.test(property.relationship)) {
          throw new Error("Invalid configured Neo4j relationship type.");
        }

        const relationshipResult = await transaction.run(
          group[0].direction === "outgoing"
            ? `
            MATCH (source:Entity {qid: $sourceQid})
            UNWIND $targetQids AS targetQid
            MATCH (target:Entity {qid: targetQid})
            MERGE (source)-[relationship:${property.relationship}]->(target)
            SET relationship.wikidataProperty = $wikidataProperty,
                relationship.label = $label,
                relationship.reverseLabel = $reverseLabel,
                relationship.weight = $weight,
                relationship.traversable = $traversable
          `
            : `
            MATCH (target:Entity {qid: $sourceQid})
            UNWIND $targetQids AS sourceQid
            MATCH (source:Entity {qid: sourceQid})
            MERGE (source)-[relationship:${property.relationship}]->(target)
            SET relationship.wikidataProperty = $wikidataProperty,
                relationship.label = $label,
                relationship.reverseLabel = $reverseLabel,
                relationship.weight = $weight,
                relationship.traversable = $traversable
          `,
          {
            sourceQid: entity.qid,
            targetQids: group.map((candidate) => candidate.targetQid),
            wikidataProperty: property.wikidataProperty,
            label: property.label,
            reverseLabel: property.reverseLabel,
            weight: getConfiguredRelationshipWeight(property, sourceType),
            traversable: property.traversable,
          },
        );

        relationshipsAdded +=
          relationshipResult.summary.counters.updates().relationshipsCreated;
      }

      return {
        sourceEntityAdded:
          sourceResult.summary.counters.updates().nodesCreated,
        linkedEntitiesAdded:
          targetResult.summary.counters.updates().nodesCreated,
        relationshipsAdded,
      };
    });

    return {
      source: {
        qid: entity.qid,
        name: entity.name,
        description: entity.description,
        type: sourceType,
      },
      ...counts,
      relationshipsDiscovered: candidates.length,
      reverseLookupComplete,
      propertiesFound,
      timings: {
        entityFetchMs: entityFetchedAt - startedAt,
        hierarchyMs: hierarchyFinishedAt - hierarchyStartedAt,
        reverseLookupMs: reverseLookupFinishedAt - reverseLookupStartedAt,
        targetSummaryMs: targetSummaryFinishedAt - targetSummaryStartedAt,
        neo4jWriteMs: Date.now() - neo4jWriteStartedAt,
        totalMs: Date.now() - startedAt,
      },
    };
  } finally {
    await session.close();
  }
}

export const ingestWikidataEntity = ingestWikidataEntityWithMetadata;
