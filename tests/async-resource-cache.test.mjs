import assert from "node:assert/strict";
import test from "node:test";

import { AsyncResourceCache } from "../lib/async-resource-cache.ts";

test("coalesces concurrent loads for the same resource", async () => {
  const cache = new AsyncResourceCache({ ttlMs: 1_000, maxEntries: 10 });
  let loads = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const loader = async () => {
    loads += 1;
    await pending;
    return "value";
  };

  const first = cache.get("Q1", loader);
  const second = cache.get("Q1", loader);
  assert.equal(cache.inFlightSize, 1);
  release();

  assert.deepEqual(await Promise.all([first, second]), ["value", "value"]);
  assert.equal(loads, 1);
  assert.equal(cache.inFlightSize, 0);
});

test("reuses live values and reloads expired values", async () => {
  let clock = 1_000;
  const cache = new AsyncResourceCache({
    ttlMs: 100,
    maxEntries: 10,
    now: () => clock,
  });
  let loads = 0;
  const loader = async () => ++loads;

  assert.equal(await cache.get("Q1", loader), 1);
  clock += 99;
  assert.equal(await cache.get("Q1", loader), 1);
  clock += 2;
  assert.equal(await cache.get("Q1", loader), 2);
});

test("evicts the least recently used value at its size bound", async () => {
  const cache = new AsyncResourceCache({ ttlMs: 1_000, maxEntries: 2 });
  const loader = (value) => async () => value;

  await cache.get("Q1", loader(1));
  await cache.get("Q2", loader(2));
  await cache.get("Q1", loader(10));
  await cache.get("Q3", loader(3));
  assert.equal(cache.size, 2);
  assert.equal(await cache.get("Q1", loader(10)), 1);
  assert.equal(await cache.get("Q2", loader(20)), 20);
});

test("does not retain rejected loads", async () => {
  const cache = new AsyncResourceCache({ ttlMs: 1_000, maxEntries: 10 });
  let loads = 0;
  const loader = async () => {
    loads += 1;
    if (loads === 1) throw new Error("temporary");
    return "recovered";
  };

  await assert.rejects(cache.get("Q1", loader), /temporary/);
  assert.equal(await cache.get("Q1", loader), "recovered");
  assert.equal(loads, 2);
});
