import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createCuratedTargetPlan,
  executeCuratedTargetPlan,
  selectVerifiedWikidataStatement,
} from "../lib/curated-target-ingestion-core.ts";

const source = {
  qid: "Q127819",
  name: "Jim Kelly",
  description: "American football quarterback",
  type: "person",
};
const target = {
  qid: "Q221626",
  name: "Buffalo Bills",
  description: "National Football League franchise in Orchard Park, New York",
  type: "sports team",
};
const relationship = {
  propertyId: "P54",
  relationshipType: "MEMBER_OF_SPORTS_TEAM",
  label: "member of sports team",
  reverseLabel: "has player",
  weight: 1.2,
  traversable: true,
  statementId: "Q127819$verified",
  statementRank: "normal",
  qualifiers: [
    { propertyId: "P580", value: "+1986-00-00T00:00:00Z" },
    { propertyId: "P582", value: "+1996-00-00T00:00:00Z" },
  ],
};
const relationshipProperties = {
  wikidataProperty: "P54",
  label: "member of sports team",
  reverseLabel: "has player",
  weight: 1.2,
  traversable: true,
};

const claim = (targetQid, rank = "normal", qualifiers = {}) => ({
  id: `Q127819$${targetQid}`,
  rank,
  mainsnak: {
    snaktype: "value",
    datatype: "wikibase-item",
    datavalue: { value: { "entity-type": "item", id: targetQid } },
  },
  qualifiers,
});

function graphState(graph) {
  return {
    totalNodes: graph.totalNodes,
    totalRelationships: graph.totalRelationships,
    sourceExists: graph.nodes.has(source.qid),
    targetExists: graph.nodes.has(target.qid),
    relationships: graph.edge ? [{ ...graph.edge }] : [],
  };
}

function executorFor(graph, options = {}) {
  return {
    async executeWrite(work) {
      const draft = {
        totalNodes: graph.totalNodes,
        totalRelationships: graph.totalRelationships,
        nodes: new Map([...graph.nodes].map(([qid, properties]) => [qid, { ...properties }])),
        edge: graph.edge ? { ...graph.edge } : null,
      };
      const result = await work({
        async readTargetState() {
          return graphState(draft);
        },
        async createMissingNodes(left, right) {
          let created = 0;
          for (const entity of [left, right]) {
            if (draft.nodes.has(entity.qid)) continue;
            draft.nodes.set(entity.qid, { ...entity });
            draft.totalNodes += 1;
            created += 1;
          }
          return created;
        },
        async createMissingRelationship() {
          if (options.failRelationship) throw new Error("simulated relationship failure");
          if (draft.edge) return 0;
          draft.edge = { ...relationshipProperties };
          draft.totalRelationships += 1;
          return 1;
        },
      });
      graph.totalNodes = draft.totalNodes;
      graph.totalRelationships = draft.totalRelationships;
      graph.nodes = draft.nodes;
      graph.edge = draft.edge;
      return result;
    },
  };
}

test("curated statement selection accepts only the exact requested non-deprecated target", () => {
  const statements = [
    claim("Q6827329"),
    claim("Q221626", "deprecated"),
    claim("Q221626", "normal", {
      P580: [{ datavalue: { value: { time: "+1986-00-00T00:00:00Z" } } }],
      P582: [{ datavalue: { value: { time: "+1996-00-00T00:00:00Z" } } }],
    }),
    claim("Q3094944"),
  ];
  const selected = selectVerifiedWikidataStatement(statements, "Q221626");
  assert.equal(selected.statementId, "Q127819$Q221626");
  assert.deepEqual(selected.qualifiers, relationship.qualifiers);
  assert.throws(
    () => selectVerifiedWikidataStatement(statements, "Q1"),
    /requested curated-target statement/,
  );
});

test("dry-run reports exactly two nodes and one relationship without expansion metadata", async () => {
  const state = {
    totalNodes: 10_209,
    totalRelationships: 13_612,
    sourceExists: false,
    targetExists: false,
    relationships: [],
  };
  const plan = createCuratedTargetPlan({ source, target, relationship, state });
  assert.deepEqual(plan.before, { nodes: 10_209, relationships: 13_612 });
  assert.deepEqual(plan.after, { nodes: 10_211, relationships: 13_613 });
  assert.deepEqual(plan.changes, {
    nodesCreated: 2,
    relationshipsCreated: 1,
    existingNodesPreserved: 0,
    existingRelationshipPreserved: false,
  });
  assert.ok(!Object.keys(plan.source).some((key) => key.includes("Expanded")));

  const serverSource = await readFile(
    new URL("../lib/curated-target-ingestion.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(serverSource, /wikidataExpanded|wikidataReverseExpanded/);
  assert.doesNotMatch(serverSource, /fetchIncomingWikidataEntities/);
  assert.match(serverSource, /executeCuratedTargetIngestion\(\s*reviewedPlan/);
  assert.match(serverSource, /reviewed curated-target plan no longer matches the ingestion allowlist/);
});

test("curated writes are idempotent and preserve existing node properties", async () => {
  const graph = {
    totalNodes: 10_209,
    totalRelationships: 13_612,
    nodes: new Map([[source.qid, { qid: source.qid, name: "Reviewed Jim Kelly", custom: true }]]),
    edge: null,
  };
  const original = structuredClone(graph.nodes.get(source.qid));
  const firstPlan = createCuratedTargetPlan({
    source,
    target,
    relationship,
    state: graphState(graph),
  });
  const first = await executeCuratedTargetPlan(firstPlan, executorFor(graph));
  assert.deepEqual({ nodes: first.nodesCreated, relationships: first.relationshipsCreated }, { nodes: 1, relationships: 1 });
  assert.deepEqual(graph.nodes.get(source.qid), original);

  const secondPlan = createCuratedTargetPlan({
    source,
    target,
    relationship,
    state: graphState(graph),
  });
  const second = await executeCuratedTargetPlan(secondPlan, executorFor(graph));
  assert.deepEqual({ nodes: second.nodesCreated, relationships: second.relationshipsCreated }, { nodes: 0, relationships: 0 });
  assert.deepEqual(graph.nodes.get(source.qid), original);
});

test("a relationship failure rolls the complete curated transaction back", async () => {
  const graph = {
    totalNodes: 10_209,
    totalRelationships: 13_612,
    nodes: new Map(),
    edge: null,
  };
  const before = {
    totalNodes: graph.totalNodes,
    totalRelationships: graph.totalRelationships,
    nodes: [...graph.nodes],
    edge: graph.edge,
  };
  const plan = createCuratedTargetPlan({ source, target, relationship, state: graphState(graph) });
  await assert.rejects(
    executeCuratedTargetPlan(plan, executorFor(graph, { failRelationship: true })),
    /simulated relationship failure/,
  );
  assert.deepEqual({
    totalNodes: graph.totalNodes,
    totalRelationships: graph.totalRelationships,
    nodes: [...graph.nodes],
    edge: graph.edge,
  }, before);
});

test("an unrelated graph-count change after dry-run fails closed", async () => {
  const graph = {
    totalNodes: 10_210,
    totalRelationships: 13_612,
    nodes: new Map(),
    edge: null,
  };
  const plan = createCuratedTargetPlan({
    source,
    target,
    relationship,
    state: { ...graphState(graph), totalNodes: 10_209 },
  });

  await assert.rejects(
    executeCuratedTargetPlan(plan, executorFor(graph)),
    /database state changed after dry-run/,
  );
  assert.equal(graph.nodes.size, 0);
  assert.equal(graph.edge, null);
});

test("unexpected existing relationship data fails closed instead of being overwritten", () => {
  assert.throws(
    () => createCuratedTargetPlan({
      source,
      target,
      relationship,
      state: {
        totalNodes: 10_211,
        totalRelationships: 13_613,
        sourceExists: true,
        targetExists: true,
        relationships: [{ ...relationshipProperties, weight: 99 }],
      },
    }),
    /will not be overwritten/,
  );
});
