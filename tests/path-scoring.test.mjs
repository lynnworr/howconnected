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

test("treats a direct team-to-sport statement as a strong semantic path", () => {
  const score = scorePath({
    nodes: [
      { id: "raiders", type: "sports team" },
      { id: "american-football", type: "entity" },
    ],
    relationships: [
      { weight: 1, storedType: "SPORT", direction: "forward" },
    ],
  });

  assert.equal(score.patternPenalty, 0);
  assert.equal(score.score, 1.15);
  assert.equal(score.qualityBand, "strong");
});

test("rejects using a shared sport to connect an unrelated team and athlete", () => {
  const score = scorePath({
    nodes: [
      { id: "team", type: "sports team" },
      { id: "football", type: "entity" },
      { id: "athlete", type: "sports person" },
    ],
    relationships: [
      { weight: 1, storedType: "SPORT", direction: "forward" },
      { weight: 1, storedType: "SPORT", direction: "reverse" },
    ],
  });

  assert.deepEqual(score.patternPenalties, [
    { kind: "shared-sport-hop", penalty: 5 },
  ]);
  assert.equal(score.qualityBand, "weak");
});

test("preserves direct athlete-team and team-league relationships", () => {
  const athleteTeam = scorePath({
    nodes: [node("athlete"), node("team")],
    relationships: [
      { weight: 1.2, storedType: "MEMBER_OF_SPORTS_TEAM", direction: "forward" },
    ],
  });
  const teamLeague = scorePath({
    nodes: [node("team"), node("league")],
    relationships: [
      { weight: 1.2, storedType: "LEAGUE", direction: "forward" },
    ],
  });

  assert.equal(athleteTeam.patternPenalty, 0);
  assert.equal(teamLeague.patternPenalty, 0);
  assert.equal(athleteTeam.qualityBand, "strong");
  assert.equal(teamLeague.qualityBand, "strong");
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

test("rejects a founder chain routed through countries and a geopolitical container", () => {
  const score = scorePath({
    nodes: [
      { id: "group", type: "company/organization" },
      { id: "denmark", type: "place" },
      { id: "union", type: "company/organization" },
      { id: "luxembourg", type: "place" },
    ],
    relationships: [
      { weight: 1, storedType: "FOUNDED_BY", direction: "forward" },
      { weight: 1.6, storedType: "PART_OF", direction: "forward" },
      { weight: 1, storedType: "FOUNDED_BY", direction: "forward" },
    ],
  });

  assert.ok(score.patternPenalties.some(({ kind }) => kind === "founder-geography-chain"));
  assert.equal(score.qualityBand, "weak");
});

test("preserves direct organization-founder relationships", () => {
  const score = scorePath({
    nodes: [
      { id: "organization", type: "company/organization" },
      { id: "founder", type: "person" },
    ],
    relationships: [
      { weight: 1, storedType: "FOUNDED_BY", direction: "forward" },
    ],
  });

  assert.equal(score.patternPenalty, 0);
  assert.equal(score.qualityBand, "strong");
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

test("rejects evidenced geographic, event, ownership, and place detours", () => {
  const cases = [
    {
      expected: "geographic-nonplace-detour",
      nodes: [
        { id: "origin", type: "place" },
        { id: "country", type: "place" },
        { id: "station", type: "transportation" },
        { id: "target", type: "place" },
      ],
      relationships: [
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
        { weight: 1.5, storedType: "LOCATED_IN_ADMINISTRATIVE_ENTITY", direction: "reverse" },
        { weight: 1.2, storedType: "PARTICIPANT_IN", direction: "reverse" },
      ],
    },
    {
      expected: "geographic-peer-detour",
      nodes: [node("vehicle"), node("country-a"), node("feature"), { id: "country-b", type: "place" }],
      relationships: [
        { weight: 1.2, storedType: "OPERATOR", direction: "forward" },
        { weight: 1.3, storedType: "COUNTRY", direction: "reverse" },
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
      ],
    },
    {
      expected: "event-organization-geography-chain",
      nodes: [node("brewery"), { id: "country", type: "place" }, { id: "expo", type: "event" }, node("city"), { id: "producer", type: "company/organization" }, node("product")],
      relationships: [
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
        { weight: 1.15, storedType: "PARTICIPANT", direction: "reverse" },
        { weight: 1.5, storedType: "LOCATED_IN_ADMINISTRATIVE_ENTITY", direction: "forward" },
        { weight: 1.2, storedType: "LOCATION", direction: "reverse" },
        { weight: 1.3, storedType: "PRODUCES", direction: "forward" },
      ],
    },
    {
      expected: "ownership-place-chain",
      nodes: [{ id: "group", type: "company/organization" }, { id: "country-a", type: "place" }, { id: "rail", type: "company/organization" }, { id: "country-b", type: "place" }],
      relationships: [
        { weight: 1, storedType: "FOUNDED_BY", direction: "forward" },
        { weight: 1.1, storedType: "OWNED_BY", direction: "reverse" },
        { weight: 1.1, storedType: "OWNED_BY", direction: "forward" },
      ],
    },
    {
      expected: "event-location-return-hop",
      nodes: [node("event-a"), { id: "city", type: "place" }, { id: "event-b", type: "historical event" }, { id: "country", type: "place" }],
      relationships: [
        { weight: 2, storedType: "SIGNIFICANT_EVENT", direction: "reverse" },
        { weight: 1.2, storedType: "LOCATION", direction: "reverse" },
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
      ],
    },
    {
      expected: "shared-participant-place-hop",
      nodes: [node("vehicle"), { id: "country-a", type: "place" }, node("event"), { id: "country-b", type: "place" }],
      relationships: [
        { weight: 1.2, storedType: "OPERATOR", direction: "forward" },
        { weight: 1.15, storedType: "PARTICIPANT", direction: "reverse" },
        { weight: 1.15, storedType: "PARTICIPANT", direction: "forward" },
      ],
    },
    {
      expected: "founder-place-detour",
      nodes: [{ id: "group", type: "company/organization" }, { id: "country-a", type: "place" }, node("carrier"), { id: "rail", type: "company/organization" }, node("station"), { id: "country-b", type: "place" }],
      relationships: [
        { weight: 1, storedType: "FOUNDED_BY", direction: "forward" },
        { weight: 1.3, storedType: "COUNTRY", direction: "reverse" },
        { weight: 1.1, storedType: "PARENT_ORGANIZATION", direction: "forward" },
        { weight: 1.2, storedType: "OPERATOR", direction: "reverse" },
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
      ],
    },
    {
      expected: "event-citizen-organization-detour",
      nodes: [{ id: "agency", type: "company/organization" }, node("employee"), { id: "war", type: "historical event" }, { id: "country", type: "place" }, node("executive"), { id: "company", type: "company/organization" }],
      relationships: [
        { weight: 1.2, storedType: "EMPLOYER", direction: "reverse" },
        { weight: 1.1, storedType: "CONFLICT", direction: "forward" },
        { weight: 1.15, storedType: "PARTICIPANT", direction: "forward" },
        { weight: 1.15, storedType: "COUNTRY_OF_CITIZENSHIP", direction: "reverse" },
        { weight: 1.1, storedType: "CHIEF_EXECUTIVE_OFFICER", direction: "reverse" },
      ],
    },
    {
      expected: "multi-place-endpoint-detour",
      nodes: [node("table"), { id: "city", type: "place" }, { id: "venue", type: "place" }, { id: "olympics", type: "event" }],
      relationships: [
        { weight: 1.2, storedType: "LOCATION", direction: "forward" },
        { weight: 1.5, storedType: "LOCATED_IN_ADMINISTRATIVE_ENTITY", direction: "reverse" },
        { weight: 2, storedType: "SIGNIFICANT_EVENT", direction: "forward" },
      ],
    },
  ];

  for (const fixture of cases) {
    const score = scorePath(fixture);
    assert.ok(score.patternPenalties.some(({ kind }) => kind === fixture.expected));
    assert.equal(score.qualityBand, "weak");
  }
});

test("preserves short direct geographic and historical chains", () => {
  const fixtures = [
    {
      nodes: [node("event"), { id: "continent", type: "place" }, { id: "country", type: "place" }],
      relationships: [
        { weight: 1.2, storedType: "LOCATION", direction: "forward" },
        { weight: 1.6, storedType: "PART_OF", direction: "reverse" },
      ],
    },
    {
      nodes: [node("prefecture"), { id: "city", type: "place" }, { id: "country", type: "place" }],
      relationships: [
        { weight: 1.5, storedType: "LOCATED_IN_ADMINISTRATIVE_ENTITY", direction: "reverse" },
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
      ],
    },
    {
      nodes: [node("event"), { id: "venue", type: "company/organization" }, { id: "city", type: "place" }, { id: "country", type: "place" }],
      relationships: [
        { weight: 1.2, storedType: "LOCATION", direction: "forward" },
        { weight: 1.1, storedType: "OWNED_BY", direction: "forward" },
        { weight: 1.3, storedType: "COUNTRY", direction: "forward" },
      ],
    },
  ];

  for (const fixture of fixtures) {
    const score = scorePath(fixture);
    assert.equal(score.patternPenalty, 0);
    assert.equal(score.qualityBand, "strong");
  }
});
