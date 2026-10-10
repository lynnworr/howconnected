import assert from "node:assert/strict";
import test from "node:test";

import { PHASE2A_REGRESSION_PAIRS } from "../scripts/phase2a-regression-pairs.mjs";

test("Phase 2A regression fixture contains the eight named defensible pairs", () => {
  assert.deepEqual(PHASE2A_REGRESSION_PAIRS, [
    ["Kevin Bacon", "Q3454165", "Paw Patrol", "Q15106029"],
    ["Steve Jobs", "Q19837", "Walt Disney", "Q8704"],
    ["George Lucas", "Q38222", "Steve Jobs", "Q19837"],
    ["Snoop Dogg", "Q6096", "Dr. Dre", "Q6078"],
    ["Statue of Liberty", "Q9202", "France", "Q142"],
    ["Concorde", "Q6505", "British Airways", "Q8766"],
    ["International Space Station", "Q25271", "NASA", "Q23548"],
    ["American football", "Q41323", "Las Vegas Raiders", "Q324523"],
  ]);
});
