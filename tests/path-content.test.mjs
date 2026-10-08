import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConnectionSeoDescription,
  generateConnectionExplanation,
  generateFunTakeaway,
  generateWhyPathWorks,
  getRelationshipCategories,
  selectFunTemplate,
} from "../lib/path-content.ts";

const mediaPath = {
  steps: 3,
  nodes: [
    { name: "Kevin Bacon", type: "person", qid: "Q1" },
    { name: "Friday the 13th", type: "work", qid: "Q2" },
    { name: "Paramount Pictures", type: "company", qid: "Q3" },
    { name: "Paw Patrol", type: "work", qid: "Q4" },
  ],
  relationships: [
    { label: "appeared in", from: "Kevin Bacon", to: "Friday the 13th" },
    { label: "production company", from: "Friday the 13th", to: "Paramount Pictures" },
    { label: "distributed", from: "Paramount Pictures", to: "Paw Patrol" },
  ],
};

const organizationPath = {
  steps: 2,
  nodes: [
    { name: "Ada", type: "person", qid: "Q10" },
    { name: "Example Lab", type: "organization", qid: "Q11" },
    { name: "Grace", type: "person", qid: "Q12" },
  ],
  relationships: [
    { label: "employer", from: "Ada", to: "Example Lab" },
    { label: "employs", from: "Example Lab", to: "Grace" },
  ],
};

test("generates complete path-specific explanation sentences", () => {
  const explanation = generateConnectionExplanation(mediaPath);

  assert.match(explanation, /^Kevin Bacon and Paw Patrol/);
  assert.match(explanation, /Kevin Bacon — appeared in — Friday the 13th/);
  assert.match(explanation, /Paramount Pictures — distributed — Paw Patrol/);
  assert.equal(explanation.split(/[.!?](?:\s|$)/).filter(Boolean).length, 3);
});

test("explanation and fun copy never add unsupported entity names", () => {
  const output = `${generateConnectionExplanation(organizationPath)} ${generateFunTakeaway(organizationPath)}`;
  const supportedNames = organizationPath.nodes.map((node) => node.name);

  assert.doesNotMatch(output, /Kevin Bacon|Paramount|Wikimedia Foundation/);
  assert.ok(supportedNames.every((name) => output.includes(name)));
});

test("summarizes relationship categories from labels", () => {
  assert.deepEqual(
    getRelationshipCategories(mediaPath).map((category) => category.key),
    ["creative"],
  );
  assert.match(generateWhyPathWorks(organizationPath), /organization and ownership/);
});

test("fun template selection is deterministic and varies by path", () => {
  assert.equal(selectFunTemplate(mediaPath), selectFunTemplate(mediaPath));
  assert.notEqual(selectFunTemplate(mediaPath), selectFunTemplate(organizationPath));
  assert.equal(generateFunTakeaway(mediaPath), generateFunTakeaway(mediaPath));
});

test("builds a concise SEO description with actual intermediary names", () => {
  const description = buildConnectionSeoDescription(mediaPath);

  assert.equal(
    description,
    "Discover how Kevin Bacon connects to Paw Patrol in 3 steps through Friday the 13th and Paramount Pictures.",
  );
  assert.ok(description.length <= 160);
});

test("does not double punctuation for entity names ending with a period", () => {
  const description = buildConnectionSeoDescription(organizationPath);
  const explanation = generateConnectionExplanation(organizationPath);

  assert.doesNotMatch(description, /\.\./);
  assert.doesNotMatch(explanation, /\.\./);
});
