import assert from "node:assert/strict";
import test from "node:test";
import { PHASE2B_REGRESSION_PAIRS } from "../scripts/phase2b-regression-pairs.mjs";

test("Phase 2B fixture contains all twelve formerly unsupported corpus pairs", () => {
  assert.equal(PHASE2B_REGRESSION_PAIRS.length, 12);
  assert.equal(new Set(PHASE2B_REGRESSION_PAIRS.map((pair) => `${pair[1]}>${pair[3]}`)).size, 12);
  assert.deepEqual(
    Object.fromEntries(
      ["P179", "P400", "P123"].map((property) => [
        property,
        PHASE2B_REGRESSION_PAIRS.filter((pair) => pair[4] === property).length,
      ]),
    ),
    { P179: 4, P400: 3, P123: 5 },
  );
});
