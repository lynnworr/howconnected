import assert from "node:assert/strict";
import test from "node:test";
import {
  prioritizeBeamFrontier,
  scoreBeamCandidate,
} from "../lib/beam-search.ts";

const candidate = (overrides) => ({
  qid: "Q1",
  relationshipWeight: 1.2,
  type: "person",
  description: "American actor",
  depth: 2,
  degree: 8,
  ...overrides,
});

test("beam scoring strongly prioritizes frontier intersections", () => {
  const ordinary = scoreBeamCandidate(candidate({ qid: "Q1" }), "television series");
  const intersecting = scoreBeamCandidate(
    candidate({ qid: "Q2", nearOpposite: true }),
    "television series",
  );

  assert.ok(intersecting < ordinary - 7);
});

test("beam scoring prioritizes direct approved bridges", () => {
  const ranked = prioritizeBeamFrontier(
    [
      candidate({ qid: "Q1", relationshipWeight: 0.8 }),
      candidate({ qid: "Q2", relationshipWeight: 2, directToOpposite: true }),
    ],
    2,
    "sports team",
  );

  assert.equal(ranked[0].qid, "Q2");
});

test("beam scoring applies a high-degree hub penalty", () => {
  const modest = scoreBeamCandidate(candidate({ qid: "Q1", degree: 8 }));
  const hub = scoreBeamCandidate(candidate({ qid: "Q2", degree: 200 }));

  assert.ok(hub > modest);
});
