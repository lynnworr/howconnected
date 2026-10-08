import type { DiscoveryConfig } from "./discovery-config.ts";
import { prioritizeBeamFrontier, scoreBeamCandidate } from "./beam-search.ts";
import {
  classifyEntityDomain,
  domainBridgePenalty,
  type EntityDomain,
} from "./entity-domain.ts";

export type DiscoveryEntity = {
  qid: string;
  name: string;
  description: string;
  type: string;
};

export type DiscoveryPath = {
  score: number;
  steps: number;
  nodes: unknown[];
  relationships: unknown[];
  relationshipScore: number;
  hopPenalty: number;
  hubPenalty: number;
  baseScore?: number;
  patternPenalty?: number;
  patternPenalties?: Array<{ kind: string; penalty: number }>;
  qualityBand?: "strong" | "acceptable" | "weak";
};

export type DiscoveryPathResult = {
  bestPath: DiscoveryPath | null;
  alternatePaths: DiscoveryPath[];
  candidatePathCount?: number;
};

export type FrontierCandidate = {
  qid: string;
  name?: string;
  relationshipWeight: number;
  type: string;
  description: string;
  degree?: number;
  nearOpposite?: boolean;
  directToOpposite?: boolean;
  priorityScore?: number;
};

export type BridgeSignals = {
  degree: number;
  directToOpposite: boolean;
};

export type DiscoveryDependencies = {
  findPaths: (fromQid: string, toQid: string) => Promise<DiscoveryPathResult>;
  getEntity: (qid: string) => Promise<DiscoveryEntity | null>;
  getExpansionState: (
    qid: string,
  ) => Promise<{ exists: boolean; expanded: boolean }>;
  ingest: (
    qid: string,
    limits: {
      maxNewEntities: number;
      maxNewRelationships: number;
      deadlineMs?: number;
    },
  ) => Promise<{
    entitiesAdded: number;
    relationshipsAdded: number;
    relationshipsDiscovered?: number;
    reverseLookupComplete?: boolean;
  }>;
  getFrontier: (qid: string) => Promise<FrontierCandidate[]>;
  getBridgeSignals?: (
    candidates: Array<{ qid: string; side: "source" | "target" }>,
    sourceSeenQids: string[],
    targetSeenQids: string[],
  ) => Promise<ReadonlyMap<string, BridgeSignals>>;
  getAssistedCandidates?: (
    fromQid: string,
    toQid: string,
    perSideCap: number,
    deadlineMs?: number,
  ) => Promise<{
    source: Array<{ qid: string; title: string; shared: boolean; domain?: EntityDomain }>;
    target: Array<{ qid: string; title: string; shared: boolean; domain?: EntityDomain }>;
    status: "ok" | "partial" | "unavailable";
  }>;
  now?: () => number;
};

export type DiscoveryResult = {
  found: boolean;
  source: DiscoveryEntity | null;
  target: DiscoveryEntity | null;
  bestPath: DiscoveryPath | null;
  alternatePaths: DiscoveryPath[];
  discovery: {
    depthReached: number;
    entitiesAdded: number;
    relationshipsAdded: number;
    expandedEntities: number;
    terminationReason: string;
    sourceQid: string;
    targetQid: string;
    expandedBySide: {
      source: DiscoveryExpansionDiagnostic[];
      target: DiscoveryExpansionDiagnostic[];
    };
    frontierConsidered: DiscoveryFrontierDiagnostic[];
    frontierSkipped: Array<
      DiscoveryFrontierDiagnostic & {
        reason: "generic" | "duplicate" | "already-seen" | "beam-cap";
      }
    >;
    closestBridges: {
      source: ClosestBridge[];
      target: ClosestBridge[];
    };
    limits: {
      entities: { used: number; limit: number };
      relationships: { used: number; limit: number };
    };
    timedOut: boolean;
    runtimeMs: number;
    frontiersIntersected: boolean;
    candidatePathCount: number;
    bestRejectedPathScore: number | null;
    bestRejectedPath: DiscoveryPath | null;
    stage: "A" | "B" | "C" | null;
    stages: Array<{
      stage: "A" | "B" | "C";
      status: "found" | "miss" | "timeout" | "unavailable";
      runtimeMs: number;
      candidates?: number;
    }>;
    wikipediaCandidates: { source: string[]; target: string[] };
  };
};

export type DiscoveryFrontierDiagnostic = {
  qid: string;
  name?: string;
  type?: string;
  side: "source" | "target";
  depth: number;
  relationshipWeight: number;
  priorityScore?: number;
  degree?: number;
  nearOpposite?: boolean;
  directToOpposite?: boolean;
};

export type ClosestBridge = {
  qid: string;
  name: string;
  type: string;
  depth: number;
  priorityScore: number;
  degree: number;
  directToOpposite: boolean;
};

export type DiscoveryExpansionDiagnostic = {
  qid: string;
  depth: number;
  alreadyExpanded: boolean;
  entitiesAdded: number;
  relationshipsAdded: number;
  relationshipsDiscovered: number;
  reverseLookupComplete: boolean | null;
};

type QueuedCandidate = FrontierCandidate & {
  depth: number;
  side: "source" | "target";
};

function isGenericEntity(candidate: FrontierCandidate): boolean {
  const value = `${candidate.type} ${candidate.description}`.toLowerCase();
  return [
    "wikimedia disambiguation",
    "wikimedia category",
    "list of",
    "class of",
    "abstract concept",
  ].some((term) => value.includes(term));
}

export function prioritizeFrontier<T extends FrontierCandidate>(
  candidates: T[],
  limit: number,
): T[] {
  return prioritizeBeamFrontier(
    candidates.filter((candidate) => !isGenericEntity(candidate)),
    limit,
  );
}

function toDiagnostic(candidate: QueuedCandidate): DiscoveryFrontierDiagnostic {
  return {
    qid: candidate.qid,
    name: candidate.name,
    type: candidate.type,
    side: candidate.side,
    depth: candidate.depth,
    relationshipWeight: candidate.relationshipWeight,
    priorityScore: candidate.priorityScore,
    degree: candidate.degree,
    nearOpposite: candidate.nearOpposite,
    directToOpposite: candidate.directToOpposite,
  };
}

function selectFrontierCandidates(
  candidates: QueuedCandidate[],
  limit: number,
  sourceOppositeDomain: EntityDomain,
  targetOppositeDomain: EntityDomain,
): {
  selected: QueuedCandidate[];
  skipped: DiscoveryResult["discovery"]["frontierSkipped"];
} {
  const bestByQid = new Map<string, QueuedCandidate>();
  const skipped: DiscoveryResult["discovery"]["frontierSkipped"] = [];

  for (const candidate of candidates) {
    if (isGenericEntity(candidate)) {
      skipped.push({ ...toDiagnostic(candidate), reason: "generic" });
      continue;
    }

    const key = `${candidate.side}:${candidate.qid}`;
    const scored = {
      ...candidate,
      priorityScore: scoreBeamCandidate(
        candidate,
        candidate.side === "source"
          ? sourceOppositeDomain
          : targetOppositeDomain,
      ),
    };
    const current = bestByQid.get(key);
    if (!current || scored.priorityScore < (current.priorityScore ?? 0)) {
      if (current) {
        skipped.push({ ...toDiagnostic(current), reason: "duplicate" });
      }
      bestByQid.set(key, scored);
    } else {
      skipped.push({ ...toDiagnostic(scored), reason: "duplicate" });
    }
  }

  const rank = (values: QueuedCandidate[]) =>
    values.sort(
      (left, right) =>
        (left.priorityScore ?? 0) - (right.priorityScore ?? 0) ||
        left.qid.localeCompare(right.qid),
    );
  const source = rank(
    [...bestByQid.values()].filter(({ side }) => side === "source"),
  );
  const target = rank(
    [...bestByQid.values()].filter(({ side }) => side === "target"),
  );
  const reserved = Math.floor(limit / 2);
  const selected = [
    ...source.splice(0, reserved),
    ...target.splice(0, reserved),
  ];
  const remainder = rank([...source, ...target]);
  selected.push(...remainder.splice(0, Math.max(0, limit - selected.length)));

  for (const candidate of remainder) {
    skipped.push({ ...toDiagnostic(candidate), reason: "beam-cap" });
  }

  return { selected: rank(selected), skipped };
}

function isAcceptable(
  paths: DiscoveryPathResult,
  config: DiscoveryConfig,
): boolean {
  return Boolean(
    paths.bestPath &&
      paths.bestPath.steps <= config.maxAcceptableSteps &&
      paths.bestPath.score <= config.acceptableScore &&
      paths.bestPath.qualityBand !== "weak",
  );
}

export async function runDiscovery(
  fromQid: string,
  toQid: string,
  dependencies: DiscoveryDependencies,
  config: DiscoveryConfig,
): Promise<DiscoveryResult> {
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + config.maxExecutionMs;
  const semanticDeadline = Math.min(
    deadline,
    startedAt + (config.semanticStageMs ?? Math.floor(config.maxExecutionMs * 0.6)),
  );
  let entitiesAdded = 0;
  let relationshipsAdded = 0;
  let expandedEntities = 0;
  let depthReached = 0;
  let timedOut = false;
  let frontiersIntersected = false;
  let candidatePathCount = 0;
  let bestRejectedPathScore: number | null = null;
  let bestRejectedPath: DiscoveryPath | null = null;
  let successfulStage: "A" | "B" | "C" | null = null;
  const stages: DiscoveryResult["discovery"]["stages"] = [];
  const wikipediaCandidates = { source: [] as string[], target: [] as string[] };
  const expandedBySide: DiscoveryResult["discovery"]["expandedBySide"] = {
    source: [],
    target: [],
  };
  const frontierConsidered: DiscoveryFrontierDiagnostic[] = [];
  const frontierSkipped: DiscoveryResult["discovery"]["frontierSkipped"] = [];
  const closestBySide = {
    source: new Map<string, ClosestBridge>(),
    target: new Map<string, ClosestBridge>(),
  };

  const observePaths = (paths: DiscoveryPathResult) => {
    candidatePathCount = paths.candidatePathCount ?? (paths.bestPath ? 1 : 0);
    if (paths.bestPath && !isAcceptable(paths, config)) {
      if (
        bestRejectedPathScore === null ||
        paths.bestPath.score < bestRejectedPathScore
      ) {
        bestRejectedPathScore = paths.bestPath.score;
        bestRejectedPath = paths.bestPath;
      }
    }
  };

  const finish = async (
    found: boolean,
    paths: DiscoveryPathResult,
    terminationReason: string,
  ): Promise<DiscoveryResult> => ({
    found,
    source: await dependencies.getEntity(fromQid),
    target: await dependencies.getEntity(toQid),
    bestPath: found ? paths.bestPath : null,
    alternatePaths: found
      ? paths.alternatePaths.filter(({ qualityBand }) => qualityBand !== "weak")
      : [],
    discovery: {
      depthReached,
      entitiesAdded,
      relationshipsAdded,
      expandedEntities,
      terminationReason,
      sourceQid: fromQid,
      targetQid: toQid,
      expandedBySide,
      frontierConsidered,
      frontierSkipped,
      closestBridges: {
        source: [...closestBySide.source.values()]
          .sort((left, right) => left.priorityScore - right.priorityScore)
          .slice(0, 5),
        target: [...closestBySide.target.values()]
          .sort((left, right) => left.priorityScore - right.priorityScore)
          .slice(0, 5),
      },
      limits: {
        entities: { used: entitiesAdded, limit: config.maxNewEntities },
        relationships: {
          used: relationshipsAdded,
          limit: config.maxNewRelationships,
        },
      },
      timedOut,
      runtimeMs: Math.max(0, now() - startedAt),
      frontiersIntersected,
      candidatePathCount,
      bestRejectedPathScore,
      bestRejectedPath,
      stage: successfulStage,
      stages,
      wikipediaCandidates,
    },
  });

  let paths = await dependencies.findPaths(fromQid, toQid);
  observePaths(paths);
  if (isAcceptable(paths, config)) {
    successfulStage = "A";
    stages.push({ stage: "A", status: "found", runtimeMs: now() - startedAt });
    return finish(true, paths, "already-connected");
  }
  stages.push({ stage: "A", status: "miss", runtimeMs: now() - startedAt });
  const semanticStartedAt = now();
  const sourceEntity = await dependencies.getEntity(fromQid);
  const targetEntity = await dependencies.getEntity(toQid);
  const sourceDomain = classifyEntityDomain(sourceEntity ?? {});
  const targetDomain = classifyEntityDomain(targetEntity ?? {});

  const frontier: QueuedCandidate[] = [
    {
      qid: fromQid,
      name: fromQid,
      relationshipWeight: 0,
      type: "entity",
      description: "",
      depth: 0,
      side: "source",
    },
    {
      qid: toQid,
      name: toQid,
      relationshipWeight: 0,
      type: "entity",
      description: "",
      depth: 0,
      side: "target",
    },
  ];
  const seenBySide = {
    source: new Set([fromQid]),
    target: new Set([toQid]),
  };

  let semanticTimedOut = false;
  semanticSearch: for (let round = 0; round < config.maxDepthPerSide; round += 1) {
    const pendingCandidates = frontier.filter(
      (candidate) => candidate.depth === round,
    );
    const bridgeSignals = dependencies.getBridgeSignals
      ? await dependencies.getBridgeSignals(
          pendingCandidates.map(({ qid, side }) => ({ qid, side })),
          [...seenBySide.source],
          [...seenBySide.target],
        )
      : new Map<string, BridgeSignals>();

    for (const candidate of pendingCandidates) {
      const oppositeSide = candidate.side === "source" ? "target" : "source";
      const signal = bridgeSignals.get(`${candidate.side}:${candidate.qid}`);
      candidate.degree = signal?.degree ?? candidate.degree ?? 0;
      candidate.nearOpposite = seenBySide[oppositeSide].has(candidate.qid);
      candidate.directToOpposite = signal?.directToOpposite ?? false;
    }

    const selection = selectFrontierCandidates(
      pendingCandidates,
      config.maxFrontierNodesPerRound,
      targetDomain,
      sourceDomain,
    );
    const roundCandidates = selection.selected;
    const skippedDiagnostics = selection.skipped.map(
      (item): DiscoveryFrontierDiagnostic => ({
        qid: item.qid,
        name: item.name,
        type: item.type,
        side: item.side,
        depth: item.depth,
        relationshipWeight: item.relationshipWeight,
        priorityScore: item.priorityScore,
        degree: item.degree,
        nearOpposite: item.nearOpposite,
        directToOpposite: item.directToOpposite,
      }),
    );
    frontierConsidered.push(
      ...roundCandidates.map(toDiagnostic),
      ...skippedDiagnostics,
    );
    frontierSkipped.push(...selection.skipped);

    for (const candidate of [
      ...roundCandidates.map(toDiagnostic),
      ...skippedDiagnostics,
    ]) {
      if (candidate.depth === 0 || candidate.priorityScore === undefined) continue;
      const bridge: ClosestBridge = {
        qid: candidate.qid,
        name: candidate.name ?? candidate.qid,
        type: classifyEntityDomain({
          type: candidate.type,
          description: "",
        }),
        depth: candidate.depth,
        priorityScore: candidate.priorityScore,
        degree: candidate.degree ?? 0,
        directToOpposite: candidate.directToOpposite ?? false,
      };
      const current = closestBySide[candidate.side].get(candidate.qid);
      if (!current || bridge.priorityScore < current.priorityScore) {
        closestBySide[candidate.side].set(candidate.qid, bridge);
      }
    }

    if (roundCandidates.length === 0) {
      break semanticSearch;
    }
    depthReached = Math.max(depthReached, round + 1);

    for (const candidate of roundCandidates) {
      if (now() >= semanticDeadline) {
        semanticTimedOut = true;
        break semanticSearch;
      }

      const state = await dependencies.getExpansionState(candidate.qid);
      let expansion = {
        qid: candidate.qid,
        depth: candidate.depth,
        alreadyExpanded: state.expanded,
        entitiesAdded: 0,
        relationshipsAdded: 0,
        relationshipsDiscovered: 0,
        reverseLookupComplete: null as boolean | null,
      };
      if (!state.expanded) {
        const remainingEntities = config.maxNewEntities - entitiesAdded;
        const remainingRelationships =
          config.maxNewRelationships - relationshipsAdded;

        if (remainingEntities <= 0) {
          return finish(false, paths, "entity-limit-reached");
        }
        if (remainingRelationships <= 0) {
          return finish(false, paths, "relationship-limit-reached");
        }

        const ingestion = await dependencies.ingest(candidate.qid, {
          maxNewEntities: remainingEntities,
          maxNewRelationships: remainingRelationships,
          deadlineMs: semanticDeadline,
        });
        entitiesAdded += ingestion.entitiesAdded;
        relationshipsAdded += ingestion.relationshipsAdded;
        expandedEntities += 1;
        expansion = {
          ...expansion,
          entitiesAdded: ingestion.entitiesAdded,
          relationshipsAdded: ingestion.relationshipsAdded,
          relationshipsDiscovered:
            ingestion.relationshipsDiscovered ?? ingestion.relationshipsAdded,
          reverseLookupComplete: ingestion.reverseLookupComplete ?? null,
        };
      }
      expandedBySide[candidate.side].push(expansion);

      if (!state.expanded) {
        paths = await dependencies.findPaths(fromQid, toQid);
        observePaths(paths);
        if (isAcceptable(paths, config)) {
          successfulStage = "B";
          stages.push({
            stage: "B",
            status: "found",
            runtimeMs: now() - semanticStartedAt,
          });
          return finish(true, paths, "connection-found");
        }
        if (now() >= semanticDeadline) {
          semanticTimedOut = true;
          break semanticSearch;
        }
      }

      const nextDepth = candidate.depth + 1;
      if (nextDepth >= config.maxDepthPerSide) continue;

      const nextCandidates = await dependencies.getFrontier(candidate.qid);
      for (const next of nextCandidates) {
        const seen = seenBySide[candidate.side];
        if (seen.has(next.qid)) {
          frontierSkipped.push({
            qid: next.qid,
            side: candidate.side,
            depth: nextDepth,
            relationshipWeight: next.relationshipWeight,
            reason: "already-seen",
          });
          continue;
        }
        seen.add(next.qid);
        frontier.push({ ...next, depth: nextDepth, side: candidate.side });
        if (seenBySide[candidate.side === "source" ? "target" : "source"].has(next.qid)) {
          frontiersIntersected = true;
        }
      }
    }

    paths = await dependencies.findPaths(fromQid, toQid);
    observePaths(paths);
    if (isAcceptable(paths, config)) {
      successfulStage = "B";
      stages.push({
        stage: "B",
        status: "found",
        runtimeMs: now() - semanticStartedAt,
      });
      return finish(true, paths, "connection-found");
    }
  }
  stages.push({
    stage: "B",
    status: semanticTimedOut ? "timeout" : "miss",
    runtimeMs: now() - semanticStartedAt,
  });

  if (now() >= deadline) {
    timedOut = true;
    return finish(false, paths, "timeout");
  }

  const assistedStartedAt = now();
  const assisted = dependencies.getAssistedCandidates
    ? await dependencies.getAssistedCandidates(
        fromQid,
        toQid,
        config.wikipediaCandidatesPerSide ?? 20,
        deadline,
      )
    : { source: [], target: [], status: "unavailable" as const };
  wikipediaCandidates.source = assisted.source.map(({ qid }) => qid);
  wikipediaCandidates.target = assisted.target.map(({ qid }) => qid);

  if (assisted.status === "unavailable" || (assisted.source.length === 0 && assisted.target.length === 0)) {
    stages.push({ stage: "C", status: "unavailable", runtimeMs: now() - assistedStartedAt });
    return finish(
      false,
      paths,
      semanticTimedOut ? "semantic-stage-timeout-assistance-unavailable" : "assistance-unavailable",
    );
  }

  const assistedLimit = config.maxAssistedCandidates ?? 8;
  const perSide = Math.floor(assistedLimit / 2);
  const rankAssisted = (
    values: Array<{ qid: string; title: string; shared: boolean; domain?: EntityDomain }>,
    oppositeDomain: EntityDomain,
  ) => [...values].sort((left, right) =>
    Number(right.shared) - Number(left.shared) ||
    domainBridgePenalty(left.domain ?? "entity", oppositeDomain) -
      domainBridgePenalty(right.domain ?? "entity", oppositeDomain) ||
    left.title.localeCompare(right.title));
  const selectedAssisted = [
    ...rankAssisted(assisted.source, targetDomain).slice(0, perSide).map((item) => ({ ...item, side: "source" as const })),
    ...rankAssisted(assisted.target, sourceDomain).slice(0, perSide).map((item) => ({ ...item, side: "target" as const })),
  ].slice(0, assistedLimit);

  const assistedSignals = dependencies.getBridgeSignals
    ? await dependencies.getBridgeSignals(
        selectedAssisted.map(({ qid, side }) => ({ qid, side })),
        [...seenBySide.source],
        [...seenBySide.target],
      )
    : new Map<string, BridgeSignals>();
  selectedAssisted.sort((left, right) => {
    const leftSignal = assistedSignals.get(`${left.side}:${left.qid}`);
    const rightSignal = assistedSignals.get(`${right.side}:${right.qid}`);
    return (
      Number(right.shared) - Number(left.shared) ||
      Number(rightSignal?.directToOpposite ?? false) - Number(leftSignal?.directToOpposite ?? false) ||
      left.title.localeCompare(right.title)
    );
  });

  for (const candidate of selectedAssisted) {
    if (now() >= deadline) {
      timedOut = true;
      stages.push({
        stage: "C",
        status: "timeout",
        runtimeMs: now() - assistedStartedAt,
        candidates: selectedAssisted.length,
      });
      return finish(false, paths, "timeout");
    }
    const state = await dependencies.getExpansionState(candidate.qid);
    if (!state.expanded) {
      const remainingEntities = config.maxNewEntities - entitiesAdded;
      const remainingRelationships = config.maxNewRelationships - relationshipsAdded;
      if (remainingEntities <= 0 || remainingRelationships <= 0) break;
      const ingestion = await dependencies.ingest(candidate.qid, {
        maxNewEntities: remainingEntities,
        maxNewRelationships: remainingRelationships,
        deadlineMs: deadline,
      });
      entitiesAdded += ingestion.entitiesAdded;
      relationshipsAdded += ingestion.relationshipsAdded;
      expandedEntities += 1;
    }
    paths = await dependencies.findPaths(fromQid, toQid);
    observePaths(paths);
    if (isAcceptable(paths, config)) {
      successfulStage = "C";
      stages.push({
        stage: "C",
        status: "found",
        runtimeMs: now() - assistedStartedAt,
        candidates: selectedAssisted.length,
      });
      return finish(true, paths, "assisted-connection-found");
    }
  }

  stages.push({
    stage: "C",
    status: now() >= deadline ? "timeout" : "miss",
    runtimeMs: now() - assistedStartedAt,
    candidates: selectedAssisted.length,
  });
  timedOut = now() >= deadline;
  return finish(
    false,
    paths,
    timedOut ? "timeout" : "no-acceptable-semantic-path",
  );
}
