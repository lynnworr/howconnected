import assert from "node:assert/strict";
import test from "node:test";
import { PHASE2A_STABILIZATION_PAIRS } from "../scripts/phase2a-stabilization-pairs.mjs";

test("Phase 2A stabilization fixture covers eight failures and fourteen suspicious paths", () => {
  assert.equal(PHASE2A_STABILIZATION_PAIRS.length, 22);
  assert.equal(new Set(PHASE2A_STABILIZATION_PAIRS.map((pair) => `${pair[1]}:${pair[3]}`)).size, 22);
  for (const [, sourceQid, , targetQid] of PHASE2A_STABILIZATION_PAIRS) {
    assert.match(sourceQid, /^Q[1-9][0-9]*$/);
    assert.match(targetQid, /^Q[1-9][0-9]*$/);
  }
});
