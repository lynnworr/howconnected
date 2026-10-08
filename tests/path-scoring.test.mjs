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

test("rewards creator citizenship while rejecting citizenship as a person shortcut", () => {
  const creatorChain = scorePath({
    nodes: [node("monument"), node("creator"), node("country")],
    relationships: [
      { weight: 1, storedType: "CREATOR", direction: "forward" },
      {
        weight: 1.15,
        storedType: "COUNTRY_OF_CITIZENSHIP",
        direction: "forward",
      },
    ],
  });
  const peopleShortcut = scorePath({
    nodes: [node("person-a"), node("country"), node("person-b")],
    relationships: [
      {
        weight: 1.15,
        storedType: "COUNTRY_OF_CITIZENSHIP",
        direction: "forward",
      },
      {
        weight: 1.15,
        storedType: "COUNTRY_OF_CITIZENSHIP",
        direction: "reverse",
      },
    ],
  });

  assert.equal(creatorChain.qualityBand, "strong");
  assert.equal(creatorChain.patternPenalty, 0);
  assert.equal(peopleShortcut.patternPenalty, 4);
  assert.equal(peopleShortcut.qualityBand, "weak");
});

test("rejects a geographic container used only to jump between countries", () => {
  const score = scorePath({
    nodes: [node("artwork"), node("france"), node("region"), node("italy")],
    relationships: [
      { weight: 1, storedType: "COUNTRY", direction: "forward" },
      { weight: 1.6, storedType: "PART_OF", direction: "forward" },
      { weight: 1.6, storedType: "PART_OF", direction: "reverse" },
    ],
  });

  assert.equal(score.patternPenalty, 4);
  assert.equal(score.qualityBand, "weak");
});

test("rejects citizenship used to jump into an unrelated geographic entity", () => {
  const score = scorePath({
    nodes: [node("person"), node("country"), node("monument")],
    relationships: [
      {
        weight: 1.15,
        storedType: "COUNTRY_OF_CITIZENSHIP",
        direction: "forward",
      },
      { weight: 1, storedType: "COUNTRY", direction: "reverse" },
    ],
  });

  assert.equal(score.patternPenalty, 4);
  assert.equal(score.qualityBand, "weak");
});

test("preserves explicit citizenship through a historical state", () => {
  const score = scorePath({
    nodes: [
      node("architect"),
      { id: "historical-state", name: "Kingdom of Denmark", type: "place" },
      { id: "modern-country", name: "Denmark", type: "place" },
    ],
    relationships: [
      {
        weight: 1.15,
        storedType: "COUNTRY_OF_CITIZENSHIP",
        direction: "forward",
      },
      { weight: 1.15, storedType: "COUNTRY", direction: "reverse" },
    ],
  });

  assert.equal(score.patternPenalty, 0);
  assert.equal(score.qualityBand, "strong");
});

test("rejects countries joined only because they founded the same organization", () => {
  const score = scorePath({
    nodes: [
      node("artwork"),
      { id: "france", type: "place" },
      { id: "union", type: "company/organization" },
      { id: "italy", type: "place" },
    ],
    relationships: [
      { weight: 1, storedType: "COUNTRY", direction: "forward" },
      { weight: 1, storedType: "FOUNDED_BY", direction: "reverse" },
      { weight: 1, storedType: "FOUNDED_BY", direction: "forward" },
    ],
  });

  assert.equal(score.patternPenalty, 4);
  assert.equal(score.qualityBand, "weak");
});

test("rejects a country used to select an unrelated citizen", () => {
  const score = scorePath({
    nodes: [
      { id: "nasa", type: "company/organization" },
      { id: "washington", type: "place" },
      { id: "usa", type: "place" },
      { id: "pemberton", type: "person" },
      { id: "coca-cola", type: "company/organization" },
    ],
    relationships: [
      { weight: 1.5, storedType: "HEADQUARTERS_LOCATION", direction: "forward" },
      { weight: 1.15, storedType: "COUNTRY", direction: "forward" },
      { weight: 1.15, storedType: "COUNTRY_OF_CITIZENSHIP", direction: "reverse" },
      { weight: 1, storedType: "FOUNDED_BY", direction: "reverse" },
    ],
  });

  assert.ok(score.patternPenalties.some(({ kind }) => kind === "country-citizen-hop"));
  assert.equal(score.qualityBand, "weak");
});

test("penalizes a structural investment hub but exempts endpoints", () => {
  const blackRock = {
    id: "blackrock",
    name: "Example Capital",
    type: "company/organization",
    description: "global asset management company",
  };
  const degrees = new Map([["blackrock", 20]]);
  const bridge = scorePath(
    {
      nodes: [node("company"), blackRock, node("executive"), node("school")],
      relationships: [
        { weight: 1.1, storedType: "OWNED_BY", direction: "forward" },
        { weight: 1.1, storedType: "CHIEF_EXECUTIVE_OFFICER", direction: "forward" },
        { weight: 1.4, storedType: "EDUCATED_AT", direction: "forward" },
      ],
    },
    degrees,
  );
  const endpoint = scorePath(
    {
      nodes: [blackRock, node("company")],
      relationships: [
        { weight: 1.1, storedType: "OWNED_BY", direction: "forward" },
      ],
    },
    degrees,
  );

  assert.ok(bridge.hubPenalty >= 4);
  assert.equal(bridge.qualityBand, "weak");
  assert.equal(endpoint.hubPenalty, 0);
});

test("prefers a direct domain relationship over a slightly cheaper indirect path", () => {
  const ranked = rankPathCandidates([
    {
      name: "indirect",
      nodes: [node("aircraft"), node("country"), node("airline")],
      relationships: [
        { weight: 1.1, storedType: "COUNTRY", direction: "forward" },
        { weight: 1.1, storedType: "LOCATION", direction: "reverse" },
      ],
    },
    {
      name: "direct operator",
      nodes: [node("aircraft"), node("airline")],
      relationships: [
        { weight: 2.5, storedType: "OPERATOR", direction: "forward" },
      ],
    },
  ]);

  assert.equal(ranked[0].name, "direct operator");
  assert.equal(ranked[0].directRelationshipBonus, 0.4);
});
