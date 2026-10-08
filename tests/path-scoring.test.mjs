import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPathQuality,
  isSemanticOnlyPath,
  dedupeRankedPaths,
  getDisplayedRelationshipLabel,
  rankPathCandidates,
  scorePath,
} from "../lib/path-scoring.ts";

const node = (id) => ({ id });
const relationship = (weight) => ({ weight });

test("uses the reverse label for backward traversal", () => {
  const config = { label: "co-founded", reverseLabel: "co-founded by" };

  assert.equal(
    getDisplayedRelationshipLabel(config, "reverse"),
    "co-founded by",
  );
});

test("scores a reverse-discovered relationship with its configured weight", () => {
  const reverseDiscovered = {
    direction: "reverse",
    weight: 1.6,
  };
  const score = scorePath({
    nodes: [node("actor"), node("work")],
    relationships: [reverseDiscovered],
  });

  assert.equal(score.relationshipScore, 1.6);
  assert.equal(score.hopPenalty, 0.15);
  assert.equal(score.score, 1.75);
});

test("sums relationship weights", () => {
  const score = scorePath({
    nodes: [node("a"), node("b"), node("c")],
    relationships: [relationship(1), relationship(1.2)],
  });

  assert.equal(score.relationshipScore, 2.2);
});

test("adds a 0.15 penalty for each hop", () => {
  const score = scorePath({
    nodes: [node("a"), node("b"), node("c")],
    relationships: [relationship(1), relationship(1)],
  });

  assert.equal(score.hopPenalty, 0.3);
  assert.equal(score.score, 2.3);
});

test("sorts lower-scoring candidates first", () => {
  const candidates = [
    {
      name: "weak direct",
      nodes: [node("a"), node("c")],
      relationships: [relationship(4)],
    },
    {
      name: "strong two-hop",
      nodes: [node("a"), node("b"), node("c")],
      relationships: [relationship(1), relationship(1)],
    },
  ];

  const ranked = rankPathCandidates(candidates);

  assert.equal(ranked[0].name, "strong two-hop");
  assert.equal(ranked[1].name, "weak direct");
});

test("removes parallel-edge alternates with the same node sequence", () => {
  const paths = [
    {
      name: "co-founded",
      nodes: [node("steve"), node("apple")],
      relationships: [relationship(1)],
    },
    {
      name: "employer",
      nodes: [node("steve"), node("apple")],
      relationships: [relationship(1.2)],
    },
  ];

  assert.deepEqual(
    dedupeRankedPaths(paths).map((path) => path.name),
    ["co-founded"],
  );
});

test("penalizes an education and repeated-membership bridge chain", () => {
  const score = scorePath({
    nodes: [
      { id: "adam", type: "person" },
      { id: "nyu", name: "NYU Tisch School", type: "educational institution" },
      { id: "oliver", type: "person" },
      { id: "guild", name: "Writers Guild", type: "company/organization" },
      { id: "kareem", type: "sports person" },
      { id: "lakers", type: "sports team" },
    ],
    relationships: [
      { weight: 1.4, storedType: "EDUCATED_AT", direction: "forward" },
      { weight: 1.4, storedType: "EDUCATED_AT", direction: "reverse" },
      { weight: 1.3, storedType: "MEMBER_OF", direction: "forward" },
      { weight: 1.3, storedType: "MEMBER_OF", direction: "reverse" },
      { weight: 1.2, storedType: "MEMBER_OF_SPORTS_TEAM", direction: "forward" },
    ],
  });

  assert.ok(score.patternPenalty >= 9);
  assert.equal(score.qualityBand, "weak");
});

test("preserves a coherent media ownership path as acceptable", () => {
  const score = scorePath({
    nodes: [node("actor"), node("film"), node("studio"), node("media"), node("service"), node("series")],
    relationships: [
      { weight: 1.6, storedType: "CAST_MEMBER", direction: "reverse" },
      { weight: 1.2, storedType: "PRODUCTION_COMPANY", direction: "forward" },
      { weight: 1.1, storedType: "SUBSIDIARY", direction: "forward" },
      { weight: 1.1, storedType: "OWNED_BY", direction: "reverse" },
      { weight: 1.3, storedType: "ORIGINAL_BROADCASTER", direction: "reverse" },
    ],
  });

  assert.equal(score.patternPenalty, 0);
  assert.equal(score.qualityBand, "acceptable");
});

test("classifies quality bands and rejects non-semantic path edges", () => {
  assert.equal(classifyPathQuality(4, 0), "strong");
  assert.equal(classifyPathQuality(7, 1), "acceptable");
  assert.equal(classifyPathQuality(7, 3), "weak");
  assert.equal(
    isSemanticOnlyPath(
      { relationships: [{ weight: 1, storedType: "CAST_MEMBER" }] },
      new Set(["CAST_MEMBER"]),
    ),
    true,
  );
  assert.equal(
    isSemanticOnlyPath(
      { relationships: [{ weight: 1, storedType: "WIKIPEDIA_LINK" }] },
      new Set(["CAST_MEMBER"]),
    ),
    false,
  );
});

test("penalizes using an event merely to jump between participants", () => {
  const score = scorePath({
    nodes: [node("person-a"), node("event"), node("person-b"), node("school")],
    relationships: [
      { weight: 1.3, storedType: "PARTICIPANT_IN", direction: "forward" },
      { weight: 1.3, storedType: "PARTICIPANT_IN", direction: "reverse" },
      { weight: 1.4, storedType: "EDUCATED_AT", direction: "forward" },
    ],
  });

  assert.equal(score.patternPenalty, 4.25);
  assert.equal(score.qualityBand, "weak");
});
