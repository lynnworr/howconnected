import neo4j, { type Node, type Path } from "neo4j-driver";
import type { NextRequest } from "next/server";
import {
  getNeo4jDriver,
  Neo4jConfigurationError,
} from "@/lib/neo4j";
import {
  dedupeRankedPaths,
  getDisplayedRelationshipLabel,
  rankPathCandidates,
  type TraversalDirection,
} from "@/lib/path-scoring";
import { RELATIONSHIP_CONFIG_BY_TYPE } from "@/lib/wikidata-properties";

const MAX_CANDIDATES = 150;
const MAX_RETURNED_PATHS = 3;
const TRAVERSABLE_RELATIONSHIP_TYPES = Object.entries(
  RELATIONSHIP_CONFIG_BY_TYPE,
).flatMap(([type, config]) => (config.traversable ? [type] : []));

type EntityProperties = {
  name: string;
  type: string;
  qid?: string;
};

type PathNode = {
  id: string;
  name: string;
  type: string;
  qid: string | null;
};

type PathRelationship = {
  label: string;
  storedType: string;
  direction: TraversalDirection;
  weight: number;
  from: string;
  to: string;
};

type CandidatePath = {
  nodes: PathNode[];
  relationships: PathRelationship[];
};

function serializeNode(node: Node): PathNode {
  const properties = node.properties as Partial<EntityProperties>;

  if (typeof properties.name !== "string" || typeof properties.type !== "string") {
    throw new Error("Neo4j returned a node with invalid entity properties.");
  }

  return {
    id: typeof properties.qid === "string" ? properties.qid : node.elementId,
    name: properties.name,
    type: properties.type,
    qid: typeof properties.qid === "string" ? properties.qid : null,
  };
}

function serializePath(path: Path): CandidatePath | null {
  const orderedNodes = [
    path.start,
    ...path.segments.map((segment) => segment.end),
  ];
  const nodes = orderedNodes.map(serializeNode);

  const relationships: PathRelationship[] = [];

  for (const segment of path.segments) {
    const relationship = segment.relationship;
    const config = RELATIONSHIP_CONFIG_BY_TYPE[relationship.type];

    if (!config?.traversable) {
      return null;
    }

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

  return { nodes, relationships };
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

  if (qids.length === 0) {
    return new Map<string, number>();
  }

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
    score: number;
  },
) {
  return {
    score: path.score,
    steps: path.relationships.length,
    nodes: path.nodes.map((pathNode) => ({
      name: pathNode.name,
      type: pathNode.type,
      qid: pathNode.qid,
    })),
    relationships: path.relationships,
    relationshipScore: path.relationshipScore,
    hopPenalty: path.hopPenalty,
    hubPenalty: path.hubPenalty,
  };
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("from")?.trim() ?? "";
  const target = request.nextUrl.searchParams.get("to")?.trim() ?? "";

  if (!source || !target) {
    return Response.json(
      {
        source,
        target,
        bestPath: null,
        alternatePaths: [],
        error: "Both from and to query parameters are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await getNeo4jDriver().executeQuery(
      `
        MATCH (source:Entity {name: $source})
        MATCH (target:Entity {name: $target})
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
        source,
        target,
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
      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, candidate);
      }
    }

    const candidates = [...candidatesByKey.values()];

    if (candidates.length === 0) {
      return Response.json(
        {
          source,
          target,
          bestPath: null,
          alternatePaths: [],
          error: "No path was found within 5 relationships.",
        },
        { status: 404 },
      );
    }

    const nodeDegrees = await getNodeDegrees(candidates);
    const rankedPaths = dedupeRankedPaths(
      rankPathCandidates(candidates, nodeDegrees),
    )
      .filter(({ qualityBand }) => qualityBand !== "weak")
      .slice(0, MAX_RETURNED_PATHS)
      .map(preparePathForResponse);

    if (rankedPaths.length === 0) {
      return Response.json(
        {
          source,
          target,
          bestPath: null,
          alternatePaths: [],
          error: "No meaningful path was found within 5 relationships.",
        },
        { status: 404 },
      );
    }

    return Response.json({
      source,
      target,
      bestPath: rankedPaths[0],
      alternatePaths: rankedPaths.slice(1),
    });
  } catch (error: unknown) {
    if (error instanceof Neo4jConfigurationError) {
      return Response.json(
        {
          source,
          target,
          bestPath: null,
          alternatePaths: [],
          error: "Neo4j is not configured.",
          missingVariables: error.missingVariables,
        },
        { status: 503 },
      );
    }

    console.error("Neo4j path query failed", error);

    return Response.json(
      {
        source,
        target,
        bestPath: null,
        alternatePaths: [],
        error: "Could not query Neo4j.",
      },
      { status: 503 },
    );
  }
}
