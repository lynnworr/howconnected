import assert from "node:assert/strict";
import test from "node:test";
import { classifyEntityDomain } from "../lib/entity-domain.ts";
import {
  selectIncomingDiscoveryProperties,
  selectOutgoingDiscoveryProperties,
} from "../lib/discovery-policy.ts";
import { APPROVED_WIKIDATA_PROPERTIES } from "../lib/wikidata-properties.ts";
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
});

test("selects domain-specific outgoing property families", () => {
  const television = ids(selectOutgoingDiscoveryProperties("television series", properties));
  const team = ids(selectOutgoingDiscoveryProperties("sports team", properties));
  const organization = ids(
    selectOutgoingDiscoveryProperties("company/organization", properties),
  );

  assert.ok(television.includes("P725"));
  assert.ok(television.includes("P272"));
  assert.ok(television.includes("P449"));
  assert.ok(team.includes("P54"));
  assert.ok(team.includes("P286"));
  assert.ok(team.includes("P115"));
  assert.ok(organization.includes("P1056"));
  assert.ok(!organization.includes("P161"));
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
