import {
  classifyEntityDomain,
  domainBridgePenalty,
  type EntityDomain,
} from "./entity-domain.ts";

export type BeamCandidate = {
  qid: string;
  relationshipWeight: number;
  type: string;
  description: string;
  depth?: number;
  degree?: number;
  nearOpposite?: boolean;
  directToOpposite?: boolean;
};

function roundScore(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function scoreBeamCandidate(
  candidate: BeamCandidate,
  oppositeDomain: EntityDomain = "entity",
): number {
  const domain = classifyEntityDomain(candidate);
  const degree = candidate.degree ?? 0;
  const hubPenalty = Math.min(Math.max(0, degree - 20) * 0.025, 2);
  const notabilityBonus = Math.min(Math.log2(degree + 1) * 0.1, 0.6);
  const descriptionBonus = candidate.description.trim() ? 0.12 : 0;

  return roundScore(
    candidate.relationshipWeight +
      (candidate.depth ?? 0) * 0.2 +
      domainBridgePenalty(domain, oppositeDomain) +
      hubPenalty -
      notabilityBonus -
      descriptionBonus -
      (candidate.nearOpposite ? 8 : 0) -
      (candidate.directToOpposite ? 5 : 0),
  );
}

export function prioritizeBeamFrontier<T extends BeamCandidate>(
  candidates: T[],
  limit: number,
  oppositeDomain: EntityDomain = "entity",
): Array<T & { priorityScore: number }> {
  const bestByQid = new Map<string, T & { priorityScore: number }>();

  for (const candidate of candidates) {
    const scored = {
      ...candidate,
      priorityScore: scoreBeamCandidate(candidate, oppositeDomain),
    };
    const current = bestByQid.get(candidate.qid);
    if (!current || scored.priorityScore < current.priorityScore) {
      bestByQid.set(candidate.qid, scored);
    }
  }

  return [...bestByQid.values()]
    .sort(
      (left, right) =>
        left.priorityScore - right.priorityScore ||
        left.relationshipWeight - right.relationshipWeight ||
        left.qid.localeCompare(right.qid),
    )
    .slice(0, limit);
}
