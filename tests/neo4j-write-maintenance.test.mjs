import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertNeo4jWritesAllowed,
  getNeo4jWriteMode,
  NEO4J_WRITE_MAINTENANCE_CODE,
  neo4jWriteMaintenanceResponse,
  Neo4jWriteMaintenanceError,
} from "../lib/neo4j-write-maintenance.ts";

test("Neo4j write mode preserves normal behavior and fails closed", () => {
  assert.equal(getNeo4jWriteMode(undefined), "enabled");
  assert.equal(getNeo4jWriteMode(" enabled "), "enabled");
  assert.equal(getNeo4jWriteMode("MAINTENANCE"), "maintenance");
  assert.equal(getNeo4jWriteMode("typo"), "invalid");
});

test("Neo4j write assertion blocks maintenance and invalid configuration", () => {
  const original = process.env.NEO4J_WRITE_MODE;
  try {
    delete process.env.NEO4J_WRITE_MODE;
    assert.doesNotThrow(() => assertNeo4jWritesAllowed());

    process.env.NEO4J_WRITE_MODE = "maintenance";
    assert.throws(
      () => assertNeo4jWritesAllowed(),
      (error) =>
        error instanceof Neo4jWriteMaintenanceError &&
        error.mode === "maintenance",
    );

    process.env.NEO4J_WRITE_MODE = "unexpected";
    assert.throws(
      () => assertNeo4jWritesAllowed(),
      (error) =>
        error instanceof Neo4jWriteMaintenanceError && error.mode === "invalid",
    );
  } finally {
    if (original === undefined) delete process.env.NEO4J_WRITE_MODE;
    else process.env.NEO4J_WRITE_MODE = original;
  }
});

test("maintenance response is explicit, temporary, and never cacheable", async () => {
  const response = neo4jWriteMaintenanceResponse("Writes are paused.");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "300");
  assert.deepEqual(await response.json(), {
    error: "Writes are paused.",
    code: NEO4J_WRITE_MAINTENANCE_CODE,
  });
});

test("all production Neo4j write sinks enforce the shared guard", async () => {
  const [ingestion, feedback, ingestRoute, discoverRoute, feedbackRoute] =
    await Promise.all([
      readFile(new URL("../lib/ingest-wikidata.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/store-path-feedback.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/ingest/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/discover/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    ]);

  assert.ok(
    ingestion.indexOf("assertNeo4jWritesAllowed();") <
      ingestion.indexOf("fetchWikidataEntity(qid)"),
  );
  assert.ok(
    feedback.indexOf("assertNeo4jWritesAllowed();") <
      feedback.indexOf("getNeo4jDriver().executeQuery"),
  );
  for (const route of [ingestRoute, discoverRoute, feedbackRoute]) {
    assert.match(route, /Neo4jWriteMaintenanceError/);
    assert.match(route, /neo4jWriteMaintenanceResponse/);
  }
});
