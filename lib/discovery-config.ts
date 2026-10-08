function configuredTimeout(): number {
  const value = Number(process.env.DISCOVERY_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 10_000 && value <= 30_000
    ? value
    : 14_000;
}

function configuredSemanticStageTimeout(totalTimeout: number): number {
  const value = Number(process.env.DISCOVERY_SEMANTIC_STAGE_MS);
  return Number.isFinite(value) && value >= 3_000 && value < totalTimeout
    ? value
    : Math.min(8_000, totalTimeout - 2_000);
}

const maxExecutionMs = configuredTimeout();

export const DISCOVERY_CONFIG = {
  maxDepthPerSide: 3,
  maxNewEntities: 400,
  maxNewRelationships: 1_000,
  maxFrontierNodesPerRound: 28,
  maxExecutionMs,
  semanticStageMs: configuredSemanticStageTimeout(maxExecutionMs),
  wikipediaCandidatesPerSide: 20,
  maxAssistedCandidates: 8,
  acceptableScore: 8,
  maxAcceptableSteps: 5,
} as const;

export type DiscoveryConfig = {
  maxDepthPerSide: number;
  maxNewEntities: number;
  maxNewRelationships: number;
  maxFrontierNodesPerRound: number;
  maxExecutionMs: number;
  semanticStageMs: number;
  wikipediaCandidatesPerSide: number;
  maxAssistedCandidates: number;
  acceptableScore: number;
  maxAcceptableSteps: number;
};
