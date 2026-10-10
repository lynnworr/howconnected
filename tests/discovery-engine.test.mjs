import assert from "node:assert/strict";
import test from "node:test";
import {
  prioritizeFrontier,
  runDiscovery,
} from "../lib/discovery-engine.ts";
import { isValidQid } from "../lib/wikidata-id.ts";

const config = {
  maxDepthPerSide: 2,
  maxNewEntities: 150,
  maxNewRelationships: 400,
  maxFrontierNodesPerRound: 20,
  maxExecutionMs: 30_000,
  acceptableScore: 8,
  maxAcceptableSteps: 5,
};

const entity = (qid) => ({
  qid,
  name: qid,
  description: "",
  type: "person",
});

const noPaths = { bestPath: null, alternatePaths: [] };
const goodPaths = {
  bestPath: {
    score: 2.3,
    steps: 2,
    nodes: [],
    relationships: [],
    relationshipScore: 2,
    hopPenalty: 0.3,
    hubPenalty: 0,
  },
  alternatePaths: [],
};

function dependencies(overrides = {}) {
  return {
    findPaths: async () => noPaths,
    getEntity: async (qid) => entity(qid),
    getExpansionState: async () => ({ exists: true, expanded: false }),
    ingest: async () => ({ entitiesAdded: 0, relationshipsAdded: 0 }),
    getFrontier: async () => [],
    ...overrides,
  };
}

test("returns immediately when an acceptable connection already exists", async () => {
  let ingestionCalls = 0;
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => goodPaths,
      getExpansionState: async () => ({ exists: true, expanded: true }),
      ingest: async () => {
        ingestionCalls += 1;
        return { entitiesAdded: 0, relationshipsAdded: 0 };
      },
    }),
    config,
  );

  assert.equal(result.found, true);
  assert.equal(result.discovery.terminationReason, "already-connected");
  assert.equal(ingestionCalls, 0);
});

test("refreshes a stale source before accepting an existing path", async () => {
  let ingestionCalls = 0;
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => goodPaths,
      ingest: async () => {
        ingestionCalls += 1;
        return {
          entitiesAdded: 0,
          relationshipsAdded: 1,
          relationshipsDiscovered: 1,
        };
      },
    }),
    config,
  );

  assert.equal(result.found, true);
  assert.equal(result.discovery.stage, "B");
  assert.equal(result.discovery.terminationReason, "connection-found");
  assert.equal(ingestionCalls, 1);
});

test("does not let a target-side path preempt a stale source refresh", async () => {
  const ingestionCalls = [];
  let pathSearches = 0;
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => {
        pathSearches += 1;
        return pathSearches >= 2 ? goodPaths : noPaths;
      },
      getExpansionState: async (qid) => ({
        exists: true,
        expanded: qid === "Q2",
      }),
      getEntity: async (qid) => ({
        ...entity(qid),
        type: qid === "Q1" ? "transportation" : "entity",
      }),
      getBridgeSignals: async (candidates) =>
        new Map(
          candidates.map(({ qid, side }) => [
            `${side}:${qid}`,
            { degree: qid === "Q2" ? 2 : 1, directToOpposite: false },
          ]),
        ),
      ingest: async (qid) => {
        ingestionCalls.push(qid);
        return {
          entitiesAdded: 0,
          relationshipsAdded: 1,
          relationshipsDiscovered: 1,
        };
      },
    }),
    { ...config, maxDepthPerSide: 1 },
  );

  assert.equal(result.found, true);
  assert.deepEqual(ingestionCalls, ["Q2", "Q1"]);
  assert.equal(result.discovery.expandedBySide.source.length, 1);
});

test("prioritizes stronger relationships and skips generic entities", () => {
  const prioritized = prioritizeFrontier(
    [
      { qid: "Q3", relationshipWeight: 1.8, type: "person", description: "" },
      { qid: "Q2", relationshipWeight: 1.0, type: "company", description: "" },
      {
        qid: "Q1",
        relationshipWeight: 0.8,
        type: "entity",
        description: "Wikimedia disambiguation page",
      },
    ],
    20,
  );

  assert.deepEqual(prioritized.map((candidate) => candidate.qid), ["Q2", "Q3"]);
});

test("enforces the configured entity limit", async () => {
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      ingest: async (_qid, limits) => ({
        entitiesAdded: limits.maxNewEntities,
        relationshipsAdded: 0,
      }),
    }),
    { ...config, maxNewEntities: 1 },
  );

  assert.equal(result.discovery.entitiesAdded, 1);
  assert.equal(result.discovery.terminationReason, "entity-limit-reached");
});

test("enforces the configured relationship limit and reports its usage", async () => {
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      ingest: async (_qid, limits) => ({
        entitiesAdded: 0,
        relationshipsAdded: limits.maxNewRelationships,
        relationshipsDiscovered: limits.maxNewRelationships,
      }),
    }),
    { ...config, maxNewRelationships: 1 },
  );

  assert.equal(result.discovery.relationshipsAdded, 1);
  assert.equal(result.discovery.limits.relationships.used, 1);
  assert.equal(result.discovery.terminationReason, "relationship-limit-reached");
});

test("passes the arbitrary opposite endpoint only as bounded ingestion context", async () => {
  const calls = [];
  await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      ingest: async (qid, limits) => {
        calls.push({ qid, limits });
        return { entitiesAdded: 0, relationshipsAdded: 0 };
      },
    }),
    { ...config, maxDepthPerSide: 1 },
  );

  assert.deepEqual(
    calls.map(({ qid, limits }) => ({
      qid,
      priorityTargetQid: limits.priorityTargetQid,
      resolveTypeHierarchy: limits.resolveTypeHierarchy,
    })),
    [
      { qid: "Q1", priorityTargetQid: "Q2", resolveTypeHierarchy: true },
      { qid: "Q2", priorityTargetQid: "Q1", resolveTypeHierarchy: true },
    ],
  );
});

test("records expansion diagnostics and rejected candidate scores", async () => {
  const rejectedPaths = {
    ...goodPaths,
    bestPath: { ...goodPaths.bestPath, score: 9 },
    candidatePathCount: 4,
  };
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => rejectedPaths,
      ingest: async () => ({
        entitiesAdded: 2,
        relationshipsAdded: 3,
        relationshipsDiscovered: 5,
        reverseLookupComplete: true,
        timings: {
          entityFetchMs: 10,
          hierarchyMs: 20,
          reverseLookupMs: 30,
          targetSummaryMs: 40,
          neo4jWriteMs: 50,
          totalMs: 150,
        },
      }),
    }),
    { ...config, maxDepthPerSide: 1 },
  );

  assert.equal(result.discovery.candidatePathCount, 4);
  assert.equal(result.discovery.bestRejectedPathScore, 9);
  assert.equal(result.discovery.expandedBySide.source[0].relationshipsDiscovered, 5);
  assert.equal(result.discovery.expandedBySide.target[0].reverseLookupComplete, true);
  assert.equal(result.discovery.expandedBySide.source[0].timings.totalMs, 150);
});

test("skips redundant path searches when ingestion discovers no relationships", async () => {
  let pathSearches = 0;
  await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => {
        pathSearches += 1;
        return noPaths;
      },
      ingest: async () => ({
        entitiesAdded: 0,
        relationshipsAdded: 0,
        relationshipsDiscovered: 0,
      }),
    }),
    { ...config, maxDepthPerSide: 1 },
  );

  assert.equal(pathSearches, 2);
});

test("refreshes only expanded roots for a source-verified direct statement", async () => {
  const ingestionCalls = [];
  let frontierCalls = 0;
  await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      getExpansionState: async () => ({ exists: true, expanded: true }),
      ingest: async (qid, limits) => {
        ingestionCalls.push({ qid, limits });
        return { entitiesAdded: 0, relationshipsAdded: 0 };
      },
      getFrontier: async () => {
        frontierCalls += 1;
        return [];
      },
    }),
    config,
  );

  assert.equal(ingestionCalls.length, 2);
  assert.ok(ingestionCalls.every(({ limits }) => limits.directTargetOnly === true));
  assert.ok(ingestionCalls.every(({ limits }) => limits.resolveTypeHierarchy === false));
  assert.equal(frontierCalls, 2);
});

test("balances each beam between source and target candidates", async () => {
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      getExpansionState: async () => ({ exists: true, expanded: true }),
      getFrontier: async (qid) =>
        Array.from({ length: 6 }, (_, index) => ({
          qid: `${qid === "Q1" ? "Q10" : "Q20"}${index + 1}`,
          name: `${qid}-${index}`,
          relationshipWeight: 1 + index / 10,
          type: "person",
          description: "notable person",
        })),
    }),
    { ...config, maxFrontierNodesPerRound: 4 },
  );

  assert.equal(
    result.discovery.expandedBySide.source.filter(({ depth }) => depth === 1).length,
    2,
  );
  assert.equal(
    result.discovery.expandedBySide.target.filter(({ depth }) => depth === 1).length,
    2,
  );
});

test("batches bridge signals once per frontier round and prioritizes a direct bridge", async () => {
  let bridgeCalls = 0;
  const expanded = [];
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      getExpansionState: async (qid) => {
        expanded.push(qid);
        return { exists: true, expanded: true };
      },
      getFrontier: async (qid) =>
        qid === "Q1"
          ? [
              { qid: "Q10", name: "ordinary", relationshipWeight: 0.8, type: "person", description: "actor" },
              { qid: "Q11", name: "bridge", relationshipWeight: 2, type: "person", description: "actor" },
            ]
          : [],
      getBridgeSignals: async (candidates) => {
        bridgeCalls += 1;
        return new Map(
          candidates.map(({ qid, side }) => [
            `${side}:${qid}`,
            { degree: 5, directToOpposite: qid === "Q11" },
          ]),
        );
      },
    }),
    { ...config, maxFrontierNodesPerRound: 2 },
  );

  assert.equal(bridgeCalls, 2);
  assert.ok(expanded.includes("Q11"));
  assert.ok(expanded.indexOf("Q11") < expanded.indexOf("Q10"));
  assert.equal(result.discovery.closestBridges.source[0].qid, "Q11");
});

test("enforces depth three without expanding a fourth level", async () => {
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      getExpansionState: async () => ({ exists: true, expanded: true }),
      getFrontier: async (qid) => {
        const value = Number(qid.slice(1));
        return [
          {
            qid: `Q${value + 10}`,
            name: `level-${value}`,
            relationshipWeight: 1,
            type: "person",
            description: "person",
          },
        ];
      },
    }),
    { ...config, maxDepthPerSide: 3 },
  );

  assert.equal(result.discovery.depthReached, 3);
  assert.equal(
    Math.max(
      ...result.discovery.expandedBySide.source.map(({ depth }) => depth),
      ...result.discovery.expandedBySide.target.map(({ depth }) => depth),
    ),
    2,
  );
});

test("terminates gracefully when the configured timeout expires", async () => {
  let clock = 0;
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({ now: () => (clock += 100) }),
    { ...config, maxExecutionMs: 50 },
  );

  assert.equal(result.discovery.timedOut, true);
  assert.equal(result.discovery.terminationReason, "timeout");
  assert.ok(result.discovery.runtimeMs >= 100);
});

test("returns at the hard deadline when a dependency never settles", async () => {
  const startedAt = performance.now();
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => new Promise(() => {}),
    }),
    { ...config, maxExecutionMs: 30 },
  );
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.found, false);
  assert.equal(result.discovery.timedOut, true);
  assert.equal(result.discovery.terminationReason, "hard-deadline-exceeded");
  assert.equal(result.discovery.stages[0].status, "timeout");
  assert.ok(elapsedMs >= 20);
  assert.ok(elapsedMs < 250);
});

test("reports strongest closest bridges on both sides", async () => {
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      getExpansionState: async () => ({ exists: true, expanded: true }),
      getFrontier: async (qid) => [
        {
          qid: qid === "Q1" ? "Q10" : "Q20",
          name: qid === "Q1" ? "Source bridge" : "Target bridge",
          relationshipWeight: 1.2,
          type: "company/organization",
          description: "notable company",
        },
      ],
    }),
    config,
  );

  assert.equal(result.discovery.closestBridges.source[0].name, "Source bridge");
  assert.equal(result.discovery.closestBridges.target[0].name, "Target bridge");
});

test("does not expose a weak existing path and gracefully skips unavailable Stage C", async () => {
  const weakPaths = {
    ...goodPaths,
    bestPath: { ...goodPaths.bestPath, score: 6, qualityBand: "weak" },
  };
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => weakPaths,
      getAssistedCandidates: async () => ({
        source: [],
        target: [],
        status: "unavailable",
      }),
    }),
    { ...config, maxDepthPerSide: 1, semanticStageMs: 5_000 },
  );

  assert.equal(result.found, false);
  assert.equal(result.bestPath, null);
  assert.equal(result.discovery.stages.at(-1).status, "unavailable");
});

test("uses bounded Wikipedia candidates only to prioritize semantic ingestion", async () => {
  let pathChecks = 0;
  const ingested = [];
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      findPaths: async () => {
        pathChecks += 1;
        return ingested.includes("Q99") ? goodPaths : noPaths;
      },
      getAssistedCandidates: async () => ({
        source: [{ qid: "Q99", title: "Shared bridge", shared: true }],
        target: [],
        status: "partial",
      }),
      ingest: async (qid) => {
        ingested.push(qid);
        return { entitiesAdded: 1, relationshipsAdded: 1 };
      },
    }),
    {
      ...config,
      maxDepthPerSide: 0,
      semanticStageMs: 5_000,
      wikipediaCandidatesPerSide: 20,
      maxAssistedCandidates: 8,
    },
  );

  assert.ok(pathChecks >= 2);
  assert.equal(result.found, true);
  assert.equal(result.discovery.stage, "C");
  assert.equal(result.discovery.terminationReason, "assisted-connection-found");
});

test("does not start assisted discovery after the semantic budget is exhausted", async () => {
  let clock = 0;
  let assistedCalls = 0;
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      now: () => (clock += 100),
      getAssistedCandidates: async () => {
        assistedCalls += 1;
        return {
          source: [{ qid: "Q9", title: "Candidate", shared: true }],
          target: [],
          status: "ok",
        };
      },
    }),
    {
      ...config,
      maxExecutionMs: 1_000,
      semanticStageMs: 300,
      maxDepthPerSide: 1,
    },
  );

  assert.equal(result.found, false);
  assert.equal(result.discovery.timedOut, false);
  assert.equal(result.discovery.terminationReason, "semantic-budget-exhausted");
  assert.equal(result.discovery.stages.at(-1).stage, "B");
  assert.equal(assistedCalls, 0);
});

test("uses the shortened total deadline across semantic and assisted stages", async () => {
  let clock = 0;
  const result = await runDiscovery(
    "Q1",
    "Q2",
    dependencies({
      now: () => (clock += 100),
      getAssistedCandidates: async () => ({
        source: [{ qid: "Q9", title: "Candidate", shared: false }],
        target: [],
        status: "partial",
      }),
    }),
    {
      ...config,
      maxExecutionMs: 600,
      semanticStageMs: 300,
      maxDepthPerSide: 0,
      wikipediaCandidatesPerSide: 20,
      maxAssistedCandidates: 8,
    },
  );

  assert.equal(result.found, false);
  assert.equal(result.discovery.timedOut, true);
  assert.equal(result.discovery.terminationReason, "timeout");
});

test("validates Wikidata QIDs", () => {
  assert.equal(isValidQid("Q19837"), true);
  assert.equal(isValidQid("Q0"), false);
  assert.equal(isValidQid("19837"), false);
  assert.equal(isValidQid("not-a-qid"), false);
});
