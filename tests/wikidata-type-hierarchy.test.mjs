import assert from "node:assert/strict";
import test from "node:test";
import {
  resetTypeHierarchyCacheForTests,
  resolveWikidataTypeHierarchy,
  TYPE_HIERARCHY_LIMITS,
} from "../lib/wikidata-type-hierarchy.ts";
import { prioritizeClaimTargets } from "../lib/wikidata-claim-routing.ts";

const claim = (qid) => ({
  mainsnak: {
    snaktype: "value",
    datatype: "wikibase-item",
    datavalue: { value: { id: qid, "entity-type": "item" } },
  },
});

test.beforeEach(() => resetTypeHierarchyCacheForTests());

test("walks and caches a bounded P279 hierarchy", async () => {
  let calls = 0;
  const parents = new Map([
    ["Q100", ["Q200"]],
    ["Q200", ["Q300"]],
    ["Q300", ["Q400"]],
  ]);
  const fetchEntities = async (qids) => {
    calls += 1;
    return qids.map((qid) => ({
      qid,
      claims: { P279: (parents.get(qid) ?? []).map(claim) },
    }));
  };

  const first = await resolveWikidataTypeHierarchy(["Q100"], { fetchEntities });
  const second = await resolveWikidataTypeHierarchy(["Q100"], { fetchEntities });

  assert.deepEqual(first, ["Q100", "Q200", "Q300"]);
  assert.deepEqual(second, first);
  assert.equal(calls, TYPE_HIERARCHY_LIMITS.maxDepth);
  assert.equal(TYPE_HIERARCHY_LIMITS.maxNodes, 40);
});

test("keeps fanout caps while moving an explicitly asserted endpoint first", () => {
  const claims = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"];
  assert.deepEqual(prioritizeClaimTargets(claims, "Q7").slice(0, 3), [
    "Q7", "Q1", "Q2",
  ]);
  assert.deepEqual(prioritizeClaimTargets(claims, "Q99"), claims);
});
