import type { RelationshipConfig } from "@/lib/wikidata-properties";

export const HOP_PENALTY_PER_STEP = 0.15;
const HUB_DEGREE_THRESHOLD = 10;
const HUB_PENALTY_PER_EXTRA_EDGE = 0.03;
const MAX_HUB_PENALTY_PER_NODE = 1.5;

export type TraversalDirection = "forward" | "reverse";

export type ScoreablePath = {
  nodes: {
    id: string;
    name?: string;
    type?: string;
    description?: string;
  }[];
  relationships: {
    weight: number;
    storedType?: string;
    direction?: TraversalDirection;
  }[];
};

export type PathQualityBand = "strong" | "acceptable" | "weak";

export type PatternPenalty = {
  kind:
    | "education-person-hop"
    | "membership-return-hop"
    | "association-return-hop"
    | "repeated-association"
    | "generic-institution-chain"
    | "investment-ownership-chain";
  penalty: number;
};

export type ScoreBreakdown = {
  relationshipScore: number;
  hopPenalty: number;
  hubPenalty: number;
  baseScore: number;
  patternPenalty: number;
  patternPenalties: PatternPenalty[];
  score: number;
  qualityBand: PathQualityBand;
};

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const ASSOCIATION_TYPES = new Set([
  "MEMBER_OF",
  "MEMBER_OF_SPORTS_TEAM",
  "MEMBER_OF_POLITICAL_PARTY",
  "PARTICIPANT",
  "PARTICIPANT_IN",
]);

const OWNERSHIP_TYPES = new Set([
  "OWNED_BY",
  "PARENT_ORGANIZATION",
  "SUBSIDIARY",
  "ACQUIRED_BY",
]);

function isGenericInstitution(node: ScoreablePath["nodes"][number]): boolean {
  const value = `${node.name ?? ""} ${node.type ?? ""} ${node.description ?? ""}`.toLowerCase();
  return (
    node.type === "educational institution" ||
    /university|college|school|guild|association|institute|institution/.test(value)
  );
}

function isInvestmentEntity(node: ScoreablePath["nodes"][number]): boolean {
  const value = `${node.name ?? ""} ${node.type ?? ""} ${node.description ?? ""}`.toLowerCase();
  return /investment|private equity|asset management|holding company|venture capital/.test(
    value,
  );
}

export function calculatePatternPenalties(
  path: ScoreablePath,
): PatternPenalty[] {
  const penalties: PatternPenalty[] = [];
  const types = path.relationships.map(({ storedType }) => storedType ?? "");

  for (let index = 0; index < path.relationships.length - 1; index += 1) {
    const current = path.relationships[index];
    const next = path.relationships[index + 1];
    if (
      current.storedType === "EDUCATED_AT" &&
      current.direction === "forward" &&
      next.storedType === "EDUCATED_AT" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "education-person-hop", penalty: 3 });
    }
    if (
      current.storedType === "MEMBER_OF" &&
      current.direction === "forward" &&
      next.storedType === "MEMBER_OF" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "membership-return-hop", penalty: 3 });
    }
    if (
      current.storedType !== "MEMBER_OF" &&
      current.storedType === next.storedType &&
      typeof current.storedType === "string" &&
      ASSOCIATION_TYPES.has(current.storedType) &&
      current.direction === "forward" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "association-return-hop", penalty: 3 });
    }
  }

  const associationCount = types.filter((type) => ASSOCIATION_TYPES.has(type)).length;
  if (associationCount >= 2) {
    penalties.push({
      kind: "repeated-association",
      penalty: roundScore((associationCount - 1) * 1.25),
    });
  }

  const genericInstitutions = path.nodes.slice(1, -1).filter(isGenericInstitution).length;
  if (genericInstitutions >= 2) {
    penalties.push({
      kind: "generic-institution-chain",
      penalty: roundScore(genericInstitutions * 1.25),
    });
  }

  const ownershipCount = types.filter((type) => OWNERSHIP_TYPES.has(type)).length;
  const investmentEntities = path.nodes.slice(1, -1).filter(isInvestmentEntity).length;
  if (ownershipCount >= 2 && investmentEntities > 0) {
    penalties.push({
      kind: "investment-ownership-chain",
      penalty: roundScore(2 + (ownershipCount - 2) * 0.75),
    });
  }

  return penalties;
}

export function classifyPathQuality(
  score: number,
  patternPenalty: number,
): PathQualityBand {
  if (score <= 5.5 && patternPenalty <= 0.5) return "strong";
  if (score <= 8 && patternPenalty <= 1.5) return "acceptable";
  return "weak";
}

export function isSemanticOnlyPath(
  path: Pick<ScoreablePath, "relationships">,
  approvedRelationshipTypes: ReadonlySet<string>,
): boolean {
  return (
    path.relationships.length > 0 &&
    path.relationships.every(
      ({ storedType }) =>
        typeof storedType === "string" && approvedRelationshipTypes.has(storedType),
    )
  );
}

export function getDisplayedRelationshipLabel(
  config: Pick<RelationshipConfig, "label" | "reverseLabel">,
  direction: TraversalDirection,
): string {
  return direction === "forward" ? config.label : config.reverseLabel;
}

export function calculateHubPenalty(
  nodes: ScoreablePath["nodes"],
  nodeDegrees: ReadonlyMap<string, number>,
): number {
  return roundScore(
    nodes.slice(1, -1).reduce((total, node) => {
      const degree = nodeDegrees.get(node.id) ?? 0;
      const penalty = Math.min(
        Math.max(0, degree - HUB_DEGREE_THRESHOLD) *
          HUB_PENALTY_PER_EXTRA_EDGE,
        MAX_HUB_PENALTY_PER_NODE,
      );

      return total + penalty;
    }, 0),
  );
}

export function scorePath(
  path: ScoreablePath,
  nodeDegrees: ReadonlyMap<string, number> = new Map(),
): ScoreBreakdown {
  const relationshipScore = roundScore(
    path.relationships.reduce(
      (total, relationship) => total + relationship.weight,
      0,
    ),
  );
  const hopPenalty = roundScore(
    path.relationships.length * HOP_PENALTY_PER_STEP,
  );
  const hubPenalty = calculateHubPenalty(path.nodes, nodeDegrees);
  const baseScore = roundScore(relationshipScore + hopPenalty + hubPenalty);
  const patternPenalties = calculatePatternPenalties(path);
  const patternPenalty = roundScore(
    patternPenalties.reduce((total, item) => total + item.penalty, 0),
  );
  const score = roundScore(baseScore + patternPenalty);

  return {
    relationshipScore,
    hopPenalty,
    hubPenalty,
    baseScore,
    patternPenalty,
    patternPenalties,
    score,
    qualityBand: classifyPathQuality(score, patternPenalty),
  };
}

export function rankPathCandidates<T extends ScoreablePath>(
  candidates: T[],
  nodeDegrees: ReadonlyMap<string, number> = new Map(),
): Array<T & ScoreBreakdown> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      ...scorePath(candidate, nodeDegrees),
    }))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.relationships.length - right.relationships.length ||
        left.relationshipScore - right.relationshipScore,
    );
}

export function dedupeRankedPaths<T extends ScoreablePath>(
  rankedPaths: T[],
): T[] {
  const seenNodeSequences = new Set<string>();

  return rankedPaths.filter((path) => {
    const nodeSequence = path.nodes.map((node) => node.id).join(">");
    if (seenNodeSequences.has(nodeSequence)) {
      return false;
    }

    seenNodeSequences.add(nodeSequence);
    return true;
  });
}
