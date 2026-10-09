import assert from "node:assert/strict";
import test from "node:test";
import { classifyEntityDomain } from "../lib/entity-domain.ts";
import {
  selectIncomingDiscoveryProperties,
  selectOutgoingDiscoveryProperties,
} from "../lib/discovery-policy.ts";
import {
  APPROVED_WIKIDATA_PROPERTIES,
  WIKIDATA_EXPANSION_VERSION,
  getConfiguredRelationshipWeight,
} from "../lib/wikidata-properties.ts";
import { DISCOVERY_CONFIG } from "../lib/discovery-config.ts";

const properties = Object.values(APPROVED_WIKIDATA_PROPERTIES);
const ids = (values) => values.map((property) => property.wikidataProperty);

test("classifies coarse entity domains from claims and descriptions", () => {
  assert.equal(
    classifyEntityDomain({ instanceOfQids: ["Q5"], description: "American film actor" }),
    "person",
  );
  assert.equal(
    classifyEntityDomain({ description: "American professional basketball team" }),
    "sports team",
  );
  assert.equal(
    classifyEntityDomain({ description: "Canadian animated television series" }),
    "television series",
  );
  assert.equal(
    classifyEntityDomain({ description: "American space and aeronautics agency" }),
    "government/scientific organization",
  );
  assert.equal(
    classifyEntityDomain({ description: "American multinational beverage corporation" }),
    "company/organization",
  );
  assert.equal(
    classifyEntityDomain({ instanceOfQids: ["Q179700"], description: "statue" }),
    "monument/artifact",
  );
  assert.equal(
    classifyEntityDomain({ description: "oil painting by Leonardo da Vinci" }),
    "monument/artifact",
  );
  assert.equal(
    classifyEntityDomain({ description: "nation of France from 1870 to 1940" }),
    "place",
  );
  assert.equal(
    classifyEntityDomain({ description: "global war from 1939 to 1945" }),
    "historical event",
  );
  assert.equal(
    classifyEntityDomain({ description: "American rapper and record producer" }),
    "music artist",
  );
  assert.equal(
    classifyEntityDomain({ description: "Swedish audio streaming service" }),
    "music organization",
  );
  assert.equal(
    classifyEntityDomain({ description: "supersonic passenger airliner" }),
    "transportation",
  );
  assert.equal(
    classifyEntityDomain({ description: "modular space station in low Earth orbit" }),
    "transportation",
  );
  assert.equal(
    classifyEntityDomain({
      instanceOfQids: ["Q999999999"],
      ancestorQids: ["Q105543609", "Q2188189"],
      description: "composition",
    }),
    "music/work",
  );
  assert.equal(
    classifyEntityDomain({
      instanceOfQids: ["Q999999998"],
      ancestorQids: ["Q35145263"],
    }),
    "place",
  );
});

test("selects bounded historical-event relationship families", () => {
  const outgoing = ids(
    selectOutgoingDiscoveryProperties("historical event", properties),
  );
  const incoming = ids(
    selectIncomingDiscoveryProperties("historical event", properties, 10),
  );

  assert.deepEqual(outgoing, [
    "P710",
    "P607",
    "P137",
    "P276",
    "P131",
    "P17",
    "P664",
    "P793",
    "P361",
  ]);
  assert.deepEqual(incoming, ["P1344", "P710"]);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P710.maxFanout, 6);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P710.reverseDiscoveryFanout, 3);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P1344.maxFanout, 4);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P1344.reverseDiscoveryFanout, 3);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P607.maxFanout, 2);
});

test("selects music work and bounded reverse artist relationships", () => {
  const work = ids(selectOutgoingDiscoveryProperties("music/work", properties));
  const artistIncoming = ids(
    selectIncomingDiscoveryProperties("music artist", properties, 10),
  );

  assert.ok(work.includes("P162"));
  assert.ok(work.includes("P767"));
  assert.ok(work.includes("P264"));
  assert.ok(work.includes("P155"));
  assert.ok(work.includes("P156"));
  assert.deepEqual(artistIncoming, ["P175", "P162", "P86", "P767"]);
  assert.ok(APPROVED_WIKIDATA_PROPERTIES.P175.reverseDiscoveryFanout <= 6);
  assert.ok(APPROVED_WIKIDATA_PROPERTIES.P162.reverseDiscoveryFanout <= 5);
});

test("selects transportation operators, manufacturers, and airline hubs", () => {
  const outgoing = ids(
    selectOutgoingDiscoveryProperties("transportation", properties),
  );
  const incoming = ids(
    selectIncomingDiscoveryProperties("transportation", properties, 10),
  );

  assert.deepEqual(outgoing.slice(0, 3), ["P176", "P137", "P113"]);
  assert.deepEqual(incoming, ["P137", "P113", "P176"]);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P113.maxFanout, 5);
  assert.equal(APPROVED_WIKIDATA_PROPERTIES.P113.reverseDiscoveryFanout, 4);
});

test("selects domain-specific outgoing property families", () => {
  const television = ids(selectOutgoingDiscoveryProperties("television series", properties));
  const team = ids(selectOutgoingDiscoveryProperties("sports team", properties));
  const organization = ids(
    selectOutgoingDiscoveryProperties("company/organization", properties),
  );
  const artifact = ids(
    selectOutgoingDiscoveryProperties("monument/artifact", properties),
  );
  const person = ids(selectOutgoingDiscoveryProperties("person", properties));

  assert.ok(television.includes("P725"));
  assert.ok(television.includes("P272"));
  assert.ok(television.includes("P449"));
  assert.ok(team.includes("P54"));
  assert.equal(team[0], "P641");
  assert.ok(team.includes("P286"));
  assert.ok(team.includes("P115"));
  assert.ok(organization.includes("P1056"));
  assert.ok(!organization.includes("P161"));
  assert.deepEqual(artifact.slice(0, 7), [
    "P495",
    "P276",
    "P17",
    "P170",
    "P84",
    "P88",
    "P131",
  ]);
  assert.ok(artifact.includes("P793"));
  assert.ok(person.includes("P27"));
  assert.ok(!organization.includes("P17"));
});

test("adds only explicitly present supported contextual properties", () => {
  const generic = ids(selectOutgoingDiscoveryProperties("entity", properties));
  const contextual = ids(selectOutgoingDiscoveryProperties("entity", properties, {
    availablePropertyIds: ["P276", "P793", "P179"],
  }));

  assert.ok(!generic.includes("P276"));
  assert.ok(contextual.includes("P276"));
  assert.ok(contextual.includes("P793"));
  assert.ok(!contextual.includes("P179"));
});

test("supports bounded sport taxonomy without broad reverse discovery", () => {
  const sport = APPROVED_WIKIDATA_PROPERTIES.P641;

  assert.equal(sport.relationship, "SPORT");
  assert.equal(sport.label, "sport");
  assert.equal(sport.reverseLabel, "sport of");
  assert.equal(sport.maxFanout, 2);
  assert.notEqual(sport.reverseDiscoveryEnabled, true);
  assert.equal(WIKIDATA_EXPANSION_VERSION, 6);
  assert.ok(ids(selectOutgoingDiscoveryProperties("sports person", properties)).includes("P641"));
  assert.ok(ids(selectOutgoingDiscoveryProperties("company/organization", properties)).includes("P641"));
  assert.ok(ids(selectOutgoingDiscoveryProperties("event", properties)).includes("P641"));
  assert.ok(ids(selectOutgoingDiscoveryProperties("entity", properties)).includes("P641"));
});

test("uses domain-aware geographic weights without weakening unrelated entities", () => {
  assert.equal(
    getConfiguredRelationshipWeight(
      APPROVED_WIKIDATA_PROPERTIES.P17,
      "monument/artifact",
    ),
    1,
  );
  assert.equal(
    getConfiguredRelationshipWeight(
      APPROVED_WIKIDATA_PROPERTIES.P17,
      "company/organization",
    ),
    1.3,
  );
});

test("historical places receive explicit predecessor and successor properties", () => {
  const place = ids(selectOutgoingDiscoveryProperties("place", properties));

  assert.ok(place.includes("P17"));
  assert.ok(place.includes("P1365"));
  assert.ok(place.includes("P1366"));
  assert.ok(place.includes("P361"));
});

test("caps domain-specific incoming property selection", () => {
  const selected = selectIncomingDiscoveryProperties(
    "company/organization",
    properties,
    3,
  );

  assert.equal(selected.length, 3);
  assert.ok(selected.every((property) => property.reverseDiscoveryEnabled));
});

test("uses the bounded production beam, depth, and graph budgets", () => {
  assert.equal(DISCOVERY_CONFIG.maxDepthPerSide, 3);
  assert.equal(DISCOVERY_CONFIG.maxFrontierNodesPerRound, 28);
  assert.equal(DISCOVERY_CONFIG.maxNewEntities, 400);
  assert.equal(DISCOVERY_CONFIG.maxNewRelationships, 1_000);
  assert.equal(DISCOVERY_CONFIG.maxExecutionMs, 14_000);
  assert.equal(DISCOVERY_CONFIG.semanticStageMs, 8_000);
  assert.equal(DISCOVERY_CONFIG.wikipediaCandidatesPerSide, 20);
  assert.equal(DISCOVERY_CONFIG.maxAssistedCandidates, 8);
});
