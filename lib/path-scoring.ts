import type { RelationshipConfig } from "@/lib/wikidata-properties";

export const HOP_PENALTY_PER_STEP = 0.15;
const HUB_DEGREE_THRESHOLD = 10;
const HUB_PENALTY_PER_EXTRA_EDGE = 0.03;
const MAX_HUB_PENALTY_PER_NODE = 1.5;
const INVESTMENT_HUB_MIN_DEGREE = 8;
const INVESTMENT_HUB_PENALTY = 4;
export const DIRECT_DOMAIN_RELATIONSHIP_BONUS = 0.4;

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
    | "shared-sport-hop"
    | "citizenship-return-hop"
    | "citizenship-geography-bounce"
    | "country-citizen-hop"
    | "geographic-return-hop"
    | "shared-organization-place-hop"
    | "founder-geography-chain"
    | "repeated-association"
    | "generic-institution-chain"
    | "investment-ownership-chain"
    | "geographic-peer-detour"
    | "event-location-return-hop"
    | "ownership-place-chain"
    | "geographic-nonplace-detour"
    | "event-organization-geography-chain"
    | "founder-place-detour"
    | "shared-participant-place-hop"
    | "event-citizen-organization-detour"
    | "shared-series-hop"
    | "shared-platform-hop"
    | "shared-publisher-hop"
    | "catalog-ownership-detour"
    | "multi-place-endpoint-detour";
  penalty: number;
};

export type ScoreBreakdown = {
  relationshipScore: number;
  hopPenalty: number;
  hubPenalty: number;
  directRelationshipBonus: number;
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

const GEOGRAPHIC_CONTAINER_TYPES = new Set([
  "COUNTRY",
  "LOCATION",
  "LOCATED_IN_ADMINISTRATIVE_ENTITY",
  "PART_OF",
]);

const DIRECT_DOMAIN_RELATIONSHIP_TYPES = new Set([
  "MANUFACTURER",
  "OPERATOR",
  "AIRLINE_HUB",
  "PRODUCER",
  "PERFORMER",
  "COMPOSER",
  "PARTICIPANT",
  "PARTICIPANT_IN",
  "CONFLICT",
  "SERIES",
  "PLATFORM",
  "PUBLISHER",
]);

const SHARED_CATALOG_PENALTIES = new Map<string, PatternPenalty["kind"]>([
  ["SERIES", "shared-series-hop"],
  ["PLATFORM", "shared-platform-hop"],
  ["PUBLISHER", "shared-publisher-hop"],
  // P750 often names the same storefront/platform represented by P400.
  ["DISTRIBUTED_BY", "shared-platform-hop"],
]);

const PLATFORM_DISTRIBUTION_TYPES = new Set(["PLATFORM", "DISTRIBUTED_BY"]);

const INVESTMENT_ADJACENT_TYPES = new Set([
  ...OWNERSHIP_TYPES,
  "CHIEF_EXECUTIVE_OFFICER",
  "EMPLOYER",
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

function isHistoricalState(node: ScoreablePath["nodes"][number]): boolean {
  const value = `${node.name ?? ""} ${node.description ?? ""}`.toLowerCase();
  return /\b(kingdom|republic|empire|caliphate|duchy|principality|historical state)\b/.test(
    value,
  );
}

function isPlaceNode(node: ScoreablePath["nodes"][number] | undefined): boolean {
  return node?.type === "place";
}

function isOrganizationNode(
  node: ScoreablePath["nodes"][number] | undefined,
): boolean {
  return node?.type?.includes("organization") === true;
}

function isEventNode(node: ScoreablePath["nodes"][number] | undefined): boolean {
  return node?.type === "event" || node?.type === "historical event";
}

export function calculatePatternPenalties(
  path: ScoreablePath,
): PatternPenalty[] {
  const penalties: PatternPenalty[] = [];
  const types = path.relationships.map(({ storedType }) => storedType ?? "");

  for (let index = 0; index < path.relationships.length - 1; index += 1) {
    const current = path.relationships[index];
    const next = path.relationships[index + 1];
    const sharedCatalogPenalty = current.storedType
      ? SHARED_CATALOG_PENALTIES.get(current.storedType)
      : undefined;
    const isSharedCatalogRelationship =
      current.storedType === next.storedType ||
      (typeof current.storedType === "string" &&
        typeof next.storedType === "string" &&
        PLATFORM_DISTRIBUTION_TYPES.has(current.storedType) &&
        PLATFORM_DISTRIBUTION_TYPES.has(next.storedType));
    if (
      sharedCatalogPenalty &&
      isSharedCatalogRelationship &&
      current.direction === "forward" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: sharedCatalogPenalty, penalty: 5 });
    }
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
    if (
      current.storedType === "SPORT" &&
      next.storedType === "SPORT" &&
      current.direction === "forward" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "shared-sport-hop", penalty: 5 });
    }
    if (
      current.storedType === "COUNTRY_OF_CITIZENSHIP" &&
      current.direction === "forward" &&
      next.storedType === "COUNTRY_OF_CITIZENSHIP" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "citizenship-return-hop", penalty: 4 });
    }
    if (
      current.storedType === "COUNTRY_OF_CITIZENSHIP" &&
      current.direction === "forward" &&
      typeof next.storedType === "string" &&
      GEOGRAPHIC_CONTAINER_TYPES.has(next.storedType) &&
      next.direction === "reverse" &&
      !(
        isHistoricalState(path.nodes[index + 1]) &&
        path.nodes[index + 2]?.type === "place"
      )
    ) {
      penalties.push({ kind: "citizenship-geography-bounce", penalty: 4 });
    }
    if (
      typeof current.storedType === "string" &&
      GEOGRAPHIC_CONTAINER_TYPES.has(current.storedType) &&
      current.direction === "forward" &&
      next.storedType === "COUNTRY_OF_CITIZENSHIP" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "country-citizen-hop", penalty: 4.5 });
    }
    if (
      current.storedType === next.storedType &&
      typeof current.storedType === "string" &&
      GEOGRAPHIC_CONTAINER_TYPES.has(current.storedType) &&
      current.direction === "forward" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "geographic-return-hop", penalty: 4 });
    }
    if (
      current.storedType === "FOUNDED_BY" &&
      next.storedType === "FOUNDED_BY" &&
      current.direction === "reverse" &&
      next.direction === "forward" &&
      path.nodes[index]?.type === "place" &&
      path.nodes[index + 2]?.type === "place"
    ) {
      penalties.push({ kind: "shared-organization-place-hop", penalty: 4 });
    }
    if (
      path.relationships.length >= 3 &&
      typeof current.storedType === "string" &&
      typeof next.storedType === "string" &&
      GEOGRAPHIC_CONTAINER_TYPES.has(current.storedType) &&
      GEOGRAPHIC_CONTAINER_TYPES.has(next.storedType) &&
      current.direction === "reverse" &&
      next.direction === "forward"
    ) {
      penalties.push({ kind: "geographic-peer-detour", penalty: 4 });
    }
    if (
      current.storedType === "SIGNIFICANT_EVENT" &&
      current.direction === "reverse" &&
      next.storedType === "LOCATION" &&
      next.direction === "reverse"
    ) {
      penalties.push({ kind: "event-location-return-hop", penalty: 4 });
    }
    if (
      path.relationships.length >= 3 &&
      current.storedType === "PARTICIPANT" &&
      next.storedType === "PARTICIPANT" &&
      current.direction === "reverse" &&
      next.direction === "forward" &&
      isPlaceNode(path.nodes[index]) &&
      isPlaceNode(path.nodes[index + 2])
    ) {
      penalties.push({ kind: "shared-participant-place-hop", penalty: 4 });
    }
    if (
      path.relationships.length >= 4 &&
      current.storedType === "PARTICIPANT" &&
      current.direction === "forward" &&
      next.storedType === "COUNTRY_OF_CITIZENSHIP" &&
      next.direction === "reverse" &&
      isEventNode(path.nodes[index]) &&
      isPlaceNode(path.nodes[index + 1]) &&
      isOrganizationNode(path.nodes[0]) &&
      isOrganizationNode(path.nodes.at(-1))
    ) {
      penalties.push({ kind: "event-citizen-organization-detour", penalty: 4 });
    }
  }

  const associationCount = types.filter((type) => ASSOCIATION_TYPES.has(type)).length;
  if (associationCount >= 2) {
    penalties.push({
      kind: "repeated-association",
      penalty: roundScore((associationCount - 1) * 1.25),
    });
  }

  const founderCount = types.filter((type) => type === "FOUNDED_BY").length;
  const placeCount = path.nodes.filter((node) => node.type === "place").length;
  const hasGeographicBridge = types.some((type) =>
    ["LOCATION", "LOCATED_IN_ADMINISTRATIVE_ENTITY", "PART_OF"].includes(type),
  );
  if (founderCount >= 2 && placeCount >= 2 && hasGeographicBridge) {
    penalties.push({ kind: "founder-geography-chain", penalty: 5 });
  }

  const genericInstitutions = path.nodes.slice(1, -1).filter(isGenericInstitution).length;
  if (genericInstitutions >= 2) {
    penalties.push({
      kind: "generic-institution-chain",
      penalty: roundScore(genericInstitutions * 1.25),
    });
  }

  const ownershipCount = types.filter((type) => OWNERSHIP_TYPES.has(type)).length;
  const catalogCount = types.filter((type) =>
    SHARED_CATALOG_PENALTIES.has(type),
  ).length;
  if (
    path.relationships.length >= 4 &&
    catalogCount >= 2 &&
    ownershipCount >= 1
  ) {
    penalties.push({ kind: "catalog-ownership-detour", penalty: 5 });
  }
  const investmentEntities = path.nodes.slice(1, -1).filter(isInvestmentEntity).length;
  if (ownershipCount >= 2 && investmentEntities > 0) {
    penalties.push({
      kind: "investment-ownership-chain",
      penalty: roundScore(2 + (ownershipCount - 2) * 0.75),
    });
  }

  if (
    ownershipCount >= 2 &&
    path.nodes.filter(isPlaceNode).length >= 2
  ) {
    penalties.push({ kind: "ownership-place-chain", penalty: 4 });
  }

  const geographicCount = types.filter((type) =>
    GEOGRAPHIC_CONTAINER_TYPES.has(type),
  ).length;
  if (
    path.relationships.length >= 3 &&
    geographicCount >= 2 &&
    isPlaceNode(path.nodes[0]) &&
    isPlaceNode(path.nodes.at(-1)) &&
    path.nodes.slice(1, -1).some((node) => !isPlaceNode(node))
  ) {
    penalties.push({ kind: "geographic-nonplace-detour", penalty: 4 });
  }

  if (
    path.relationships.length >= 4 &&
    geographicCount >= 2 &&
    path.nodes.slice(1, -1).some(isEventNode) &&
    path.nodes.slice(1, -1).some(isOrganizationNode)
  ) {
    penalties.push({ kind: "event-organization-geography-chain", penalty: 4 });
  }

  if (
    path.relationships.length >= 3 &&
    path.relationships[0]?.storedType === "FOUNDED_BY" &&
    path.relationships[0]?.direction === "forward" &&
    isOrganizationNode(path.nodes[0]) &&
    isPlaceNode(path.nodes[1]) &&
    isPlaceNode(path.nodes.at(-1)) &&
    path.nodes.slice(2, -1).some((node) => !isPlaceNode(node))
  ) {
    penalties.push({ kind: "founder-place-detour", penalty: 4 });
  }

  const hasConsecutiveIntermediatePlaces = path.nodes
    .slice(1, -2)
    .some((node, index) =>
      isPlaceNode(node) && isPlaceNode(path.nodes[index + 2]),
    );
  if (
    path.relationships.length >= 3 &&
    !isPlaceNode(path.nodes[0]) &&
    !isPlaceNode(path.nodes.at(-1)) &&
    hasConsecutiveIntermediatePlaces
  ) {
    penalties.push({ kind: "multi-place-endpoint-detour", penalty: 3 });
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
  path: ScoreablePath,
  nodeDegrees: ReadonlyMap<string, number>,
): number {
  return roundScore(
    path.nodes.slice(1, -1).reduce((total, node, intermediateIndex) => {
      const degree = nodeDegrees.get(node.id) ?? 0;
      let penalty = Math.min(
        Math.max(0, degree - HUB_DEGREE_THRESHOLD) *
          HUB_PENALTY_PER_EXTRA_EDGE,
        MAX_HUB_PENALTY_PER_NODE,
      );
      const pathNodeIndex = intermediateIndex + 1;
      const adjacentTypes = [
        path.relationships[pathNodeIndex - 1]?.storedType,
        path.relationships[pathNodeIndex]?.storedType,
      ];
      if (
        degree >= INVESTMENT_HUB_MIN_DEGREE &&
        isInvestmentEntity(node) &&
        adjacentTypes.some(
          (type) => typeof type === "string" && INVESTMENT_ADJACENT_TYPES.has(type),
        )
      ) {
        penalty += INVESTMENT_HUB_PENALTY;
      }

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
  const hubPenalty = calculateHubPenalty(path, nodeDegrees);
  const directRelationshipBonus =
    path.relationships.length === 1 &&
    typeof path.relationships[0]?.storedType === "string" &&
    DIRECT_DOMAIN_RELATIONSHIP_TYPES.has(path.relationships[0].storedType)
      ? DIRECT_DOMAIN_RELATIONSHIP_BONUS
      : 0;
  const baseScore = roundScore(
    relationshipScore + hopPenalty + hubPenalty - directRelationshipBonus,
  );
  const patternPenalties = calculatePatternPenalties(path);
  const patternPenalty = roundScore(
    patternPenalties.reduce((total, item) => total + item.penalty, 0),
  );
  const score = roundScore(baseScore + patternPenalty);

  return {
    relationshipScore,
    hopPenalty,
    hubPenalty,
    directRelationshipBonus,
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
