import "server-only";

import neo4j, { type Node, type Path } from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/neo4j";
import {
  dedupeRankedPaths,
  getDisplayedRelationshipLabel,
  isSemanticOnlyPath,
  rankPathCandidates,
  type PathQualityBand,
  type PatternPenalty,
  type TraversalDirection,
} from "@/lib/path-scoring";
import {
  RELATIONSHIP_CONFIG_BY_TYPE,
  type RelationshipConfig,
} from "@/lib/wikidata-properties";

const MAX_CANDIDATES = 150;
const MAX_RETURNED_PATHS = 3;
const TRAVERSABLE_RELATIONSHIP_TYPES = Object.entries(
  RELATIONSHIP_CONFIG_BY_TYPE,
).flatMap(([type, config]) => (config.traversable ? [type] : []));

type EntityProperties = {
  name: string;
  type: string;
  qid?: string;
  description?: string;
};

type InternalPathNode = {
  id: string;
  name: string;
  type: string;
  qid: string | null;
  description: string;
};

export type RankedPathRelationship = {
  label: string;
  storedType: string;
  direction: TraversalDirection;
  weight: number;
  from: string;
  to: string;
};

type CandidatePath = {
  nodes: InternalPathNode[];
  relationships: RankedPathRelationship[];
};

export type RankedPath = {
  score: number;
  steps: number;
  nodes: Omit<InternalPathNode, "id" | "description">[];
  relationships: RankedPathRelationship[];
  relationshipScore: number;
  hopPenalty: number;
  hubPenalty: number;
  directRelationshipBonus: number;
  baseScore: number;
  patternPenalty: number;
  patternPenalties: PatternPenalty[];
  qualityBand: PathQualityBand;
};

export type RankedPathResult = {
  bestPath: RankedPath | null;
  alternatePaths: RankedPath[];
  candidatePathCount: number;
};

type Selector = { field: "name" | "qid"; value: string };

function serializeNode(node: Node): InternalPathNode {
  const properties = node.properties as Partial<EntityProperties>;

  if (typeof properties.name !== "string" || typeof properties.type !== "string") {
    throw new Error("Neo4j returned a node with invalid entity properties.");
  }

  return {
    id: typeof properties.qid === "string" ? properties.qid : node.elementId,
    name: properties.name,
    type: properties.type,
    qid: typeof properties.qid === "string" ? properties.qid : null,
    description:
      typeof properties.description === "string" ? properties.description : "",
  };
}

function serializePath(path: Path): CandidatePath | null {
  const orderedNodes = [
    path.start,
    ...path.segments.map((segment) => segment.end),
  ];
  const nodes = orderedNodes.map(serializeNode);
  const relationships: RankedPathRelationship[] = [];

  for (const segment of path.segments) {
    const relationship = segment.relationship;
    const config: RelationshipConfig | undefined =
      RELATIONSHIP_CONFIG_BY_TYPE[relationship.type];

    if (!config?.traversable) return null;

    const direction: TraversalDirection =
      relationship.startNodeElementId === segment.start.elementId
        ? "forward"
        : "reverse";

    relationships.push({
      label: getDisplayedRelationshipLabel(config, direction),
      storedType: relationship.type,
      direction,
      weight:
        typeof relationship.properties.weight === "number"
          ? relationship.properties.weight
          : neo4j.isInt(relationship.properties.weight)
            ? relationship.properties.weight.toNumber()
            : config.weight,
      from: serializeNode(segment.start).name,
      to: serializeNode(segment.end).name,
    });
  }

  const approvedTypes = new Set(Object.keys(RELATIONSHIP_CONFIG_BY_TYPE));
  return isSemanticOnlyPath({ relationships }, approvedTypes)
    ? { nodes, relationships }
    : null;
}

function candidateKey(candidate: CandidatePath): string {
  return [
    candidate.nodes.map((node) => node.id).join(">"),
    candidate.relationships
      .map((relationship) => relationship.storedType)
      .join(">"),
  ].join("|");
}

async function getNodeDegrees(candidates: CandidatePath[]) {
  const qids = [
    ...new Set(
      candidates.flatMap((candidate) =>
        candidate.nodes
          .slice(1, -1)
          .map((node) => node.qid)
          .filter((qid): qid is string => qid !== null),
      ),
    ),
  ];

  if (qids.length === 0) return new Map<string, number>();

  const result = await getNeo4jDriver().executeQuery(
    `
      MATCH (node:Entity)
      WHERE node.qid IN $qids
      OPTIONAL MATCH (node)-[relationship]-()
      RETURN node.qid AS qid, count(relationship) AS degree
    `,
    { qids },
  );

  return new Map(
    result.records.map((record): [string, number] => {
      const degree = record.get("degree");
      return [
        record.get("qid") as string,
        neo4j.isInt(degree) ? degree.toNumber() : Number(degree),
      ];
    }),
  );
}

function preparePathForResponse(
  path: CandidatePath & {
    relationshipScore: number;
    hopPenalty: number;
    hubPenalty: number;
    directRelationshipBonus: number;
    baseScore: number;
    patternPenalty: number;
    patternPenalties: PatternPenalty[];
    qualityBand: PathQualityBand;
    score: number;
  },
): RankedPath {
  return {
    score: path.score,
    steps: path.relationships.length,
    nodes: path.nodes.map((node) => ({
      name: node.name,
      type: node.type,
      qid: node.qid,
    })),
    relationships: path.relationships,
    relationshipScore: path.relationshipScore,
    hopPenalty: path.hopPenalty,
    hubPenalty: path.hubPenalty,
    directRelationshipBonus: path.directRelationshipBonus,
    baseScore: path.baseScore,
    patternPenalty: path.patternPenalty,
    patternPenalties: path.patternPenalties,
    qualityBand: path.qualityBand,
  };
}

async function findRankedPaths(
  source: Selector,
  target: Selector,
): Promise<RankedPathResult> {
  const directResult = await getNeo4jDriver().executeQuery(
    `
      MATCH (source:Entity {${source.field}: $source})
      MATCH (target:Entity {${target.field}: $target})
      MATCH path = (source)-[relationship]-(target)
      WHERE type(relationship) IN $traversableRelationshipTypes
      RETURN path
      LIMIT $candidateLimit
    `,
    {
      source: source.value,
      target: target.value,
      candidateLimit: neo4j.int(MAX_CANDIDATES),
      traversableRelationshipTypes: TRAVERSABLE_RELATIONSHIP_TYPES,
    },
  );
  const directCandidates = directResult.records.flatMap((record) => {
    const value: unknown = record.get("path");
    if (!neo4j.isPath(value)) return [];
    const candidate = serializePath(value);
    return candidate ? [candidate] : [];
  });

  if (directCandidates.length > 0) {
    const rankedPaths = dedupeRankedPaths(rankPathCandidates(directCandidates))
      .slice(0, MAX_RETURNED_PATHS)
      .map(preparePathForResponse);
    return {
      bestPath: rankedPaths[0] ?? null,
      alternatePaths: rankedPaths.slice(1),
      candidatePathCount: directCandidates.length,
    };
  }

  const result = await getNeo4jDriver().executeQuery(
    `
      MATCH (source:Entity {${source.field}: $source})
      MATCH (target:Entity {${target.field}: $target})
      MATCH path = (source)-[*1..5]-(target)
      WHERE all(
        node IN nodes(path)
        WHERE single(other IN nodes(path) WHERE other = node)
      )
      AND all(
        relationship IN relationships(path)
        WHERE type(relationship) IN $traversableRelationshipTypes
      )
      RETURN path
      LIMIT $candidateLimit
    `,
    {
      source: source.value,
      target: target.value,
      candidateLimit: neo4j.int(MAX_CANDIDATES),
      traversableRelationshipTypes: TRAVERSABLE_RELATIONSHIP_TYPES,
    },
  );
  const candidatesByKey = new Map<string, CandidatePath>();

  for (const record of result.records) {
    const value: unknown = record.get("path");
    if (!neo4j.isPath(value)) continue;

    const candidate = serializePath(value);
    if (!candidate) continue;

    const key = candidateKey(candidate);
    if (!candidatesByKey.has(key)) candidatesByKey.set(key, candidate);
  }

  const candidates = [...candidatesByKey.values()];
  if (candidates.length === 0) {
    return { bestPath: null, alternatePaths: [], candidatePathCount: 0 };
  }

  const nodeDegrees = await getNodeDegrees(candidates);
  const rankedPaths = dedupeRankedPaths(
    rankPathCandidates(candidates, nodeDegrees),
  )
    .slice(0, MAX_RETURNED_PATHS)
    .map(preparePathForResponse);

  return {
    bestPath: rankedPaths[0] ?? null,
    alternatePaths: rankedPaths.slice(1),
    candidatePathCount: candidates.length,
  };
}

export function findRankedPathsByNames(
  sourceName: string,
  targetName: string,
): Promise<RankedPathResult> {
  return findRankedPaths(
    { field: "name", value: sourceName },
    { field: "name", value: targetName },
  );
}

export function findRankedPathsByQids(
  sourceQid: string,
  targetQid: string,
): Promise<RankedPathResult> {
  return findRankedPaths(
    { field: "qid", value: sourceQid },
    { field: "qid", value: targetQid },
  );
}
