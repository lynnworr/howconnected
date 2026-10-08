import assert from "node:assert/strict";
import test from "node:test";
import {
  rankSearchCandidates,
  scoreSearchCandidate,
} from "../lib/search-ranking.ts";

const candidate = (overrides) => ({
  id: "Q1",
  label: "Example",
  description: "",
  aliases: [],
  ...overrides,
});

test("rewards exact label matches", () => {
  const exact = candidate({ id: "Q1", label: "Mercury" });
  const partial = candidate({ id: "Q2", label: "Mercury Records" });

  assert.ok(
    scoreSearchCandidate("Mercury", exact) >
      scoreSearchCandidate("Mercury", partial),
  );
});

test("uses alias matches", () => {
  const alias = candidate({ aliases: ["The Washington Post."] });
  assert.ok(scoreSearchCandidate("The Washington Post", alias) > 70);
});

test("generic titled artwork does not outrank a matching person alias", () => {
  const artwork = candidate({
    id: "Q1",
    label: "Queen Elizabeth II",
    description: "painting by an artist",
    wikidataRank: 2,
  });
  const monarch = candidate({
    id: "Q2",
    label: "Elizabeth II",
    aliases: ["Queen Elizabeth II."],
    description: "Queen of the United Kingdom from 1952 to 2022",
    wikidataRank: 9,
  });

  assert.deepEqual(
    rankSearchCandidates("Queen Elizabeth II", [artwork, monarch]).map(
      (item) => item.id,
    ),
    ["Q2", "Q1"],
  );
});

test("useful descriptions and upstream relevance beat generic names", () => {
  const generic = candidate({
    id: "Q1",
    label: "Jordan",
    description: "given name",
    wikidataRank: 0,
  });
  const notable = candidate({
    id: "Q2",
    label: "Michael Jordan",
    description: "American basketball player",
    wikidataRank: 1,
  });

  assert.deepEqual(
    rankSearchCandidates("Jordan", [generic, notable]).map((item) => item.id),
    ["Q2", "Q1"],
  );
});

test("penalizes disambiguation pages", () => {
  const page = candidate({
    description: "Wikimedia disambiguation page",
  });
  assert.ok(scoreSearchCandidate("Example", page) < 120);
});

test("recognizes a notable acronym alias without hard-coding the entity", () => {
  const ranked = rankSearchCandidates("NASA", [
    {
      id: "Q1",
      label: "11365 NASA",
      description: "asteroid",
      aliases: ["NASA"],
      wikidataRank: 0,
    },
    {
      id: "Q2",
      label: "National Aeronautics and Space Administration",
      description: "American space and aeronautics agency",
      aliases: ["NASA"],
      wikidataRank: 1,
    },
  ]);

  assert.equal(ranked[0].id, "Q2");
});
