import assert from "node:assert/strict";
import test from "node:test";
import { pickSurprisePair, SURPRISE_PAIRS } from "../lib/surprise-pairs.ts";

test("surprise pool is curated, diverse, and uses valid entity identifiers", () => {
  assert.ok(SURPRISE_PAIRS.length >= 6);
  assert.equal(new Set(SURPRISE_PAIRS.map(({ id }) => id)).size, SURPRISE_PAIRS.length);
  for (const pair of SURPRISE_PAIRS) {
    assert.match(pair.from.id, /^Q\d+$/);
    assert.match(pair.to.id, /^Q\d+$/);
    assert.notEqual(pair.from.id, pair.to.id);
    assert.ok(pair.hook.length > 20);
  }
});

test("surprise selection avoids the current and recently shown pairs", () => {
  const current = SURPRISE_PAIRS[0];
  const recent = [SURPRISE_PAIRS[1].id, SURPRISE_PAIRS[2].id];
  const selected = pickSurprisePair(current.id, recent, 0);

  assert.notEqual(selected.id, current.id);
  assert.ok(!recent.includes(selected.id));
});

test("surprise selection still returns a different pair after recent pool exhaustion", () => {
  const current = SURPRISE_PAIRS[0];
  const recent = SURPRISE_PAIRS.slice(1).map(({ id }) => id);
  const selected = pickSurprisePair(current.id, recent, 0.5);

  assert.notEqual(selected.id, current.id);
});
