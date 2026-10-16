import neo4j from "neo4j-driver";
import { randomUUID } from "node:crypto";

const args = new Set(process.argv.slice(2));
const target = [...args]
  .find((value) => value.startsWith("--target="))
  ?.slice("--target=".length) ?? "free";
const readOnly = args.has("--read-only");
const useDefaultDatabase = args.has("--use-default-database");

if (!new Set(["free", "current"]).has(target)) {
  throw new Error("Target must be either free or current.");
}
if (target === "current" && !readOnly) {
  throw new Error("The current database may only be validated with --read-only.");
}

const prefix = target === "free" ? "NEO4J_FREE" : "NEO4J";
const requiredNames = [`${prefix}_URI`, `${prefix}_USERNAME`, `${prefix}_PASSWORD`];
const missingNames = requiredNames.filter((name) => !process.env[name]?.trim());
if (missingNames.length > 0) {
  console.error(`Missing required variables: ${missingNames.join(", ")}`);
  process.exitCode = 2;
} else {
  await validate();
}

async function validate() {
  const uri = process.env[`${prefix}_URI`];
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];
  const configuredDatabase = process.env[`${prefix}_DATABASE`]?.trim();
  const database = useDefaultDatabase ? undefined : configuredDatabase || undefined;
  const expectedNodes = parseExpectedCount("NEO4J_FREE_EXPECTED_NODES", 10_208);
  const expectedRelationships = parseExpectedCount(
    "NEO4J_FREE_EXPECTED_RELATIONSHIPS",
    13_612,
  );
  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    connectionAcquisitionTimeout: 10_000,
    connectionTimeout: 10_000,
    maxConnectionPoolSize: 5,
  });
  const measurements = [];
  const report = {
    target,
    database: database ?? "home/default",
    readOnly,
    connectivity: false,
    server: null,
    permissions: { read: false, write: false },
    counts: null,
    schema: null,
    lookups: [],
    paths: [],
    writeTest: readOnly ? { status: "skipped" } : { status: "not_started" },
    latencyMs: null,
    warnings: [],
    failures: [],
  };

  try {
    const connectivityStartedAt = performance.now();
    await driver.verifyConnectivity(database ? { database } : undefined);
    measurements.push(performance.now() - connectivityStartedAt);
    report.connectivity = true;

    try {
      report.server = await readServerInfo(driver, database, measurements);
    } catch (error) {
      report.warnings.push(`Server metadata unavailable: ${safeError(error)}`);
    }
    const beforeCounts = await readCounts(driver, database, measurements);
    report.permissions.read = true;
    report.counts = {
      ...beforeCounts,
      expectedNodes,
      expectedRelationships,
      matchesExpectedSnapshot:
        target === "free" &&
        beforeCounts.nodes === expectedNodes &&
        beforeCounts.relationships === expectedRelationships,
    };
    report.schema = await readSchema(driver, database, measurements);

    for (const entity of [
      { qid: "Q937", expectedName: "Albert Einstein" },
      { qid: "Q935", expectedName: "Isaac Newton" },
      { qid: "Q19837", expectedName: "Steve Jobs" },
      { qid: "Q312", expectedName: "Apple" },
    ]) {
      report.lookups.push(
        await lookupQid(driver, database, measurements, entity),
      );
    }

    for (const pair of [
      { label: "Einstein to Newton", from: "Q937", to: "Q935" },
      { label: "Steve Jobs to Apple", from: "Q19837", to: "Q312" },
      { label: "Walt Disney to Disney", from: "Q8704", to: "Q7414" },
      { label: "George Lucas to Star Wars", from: "Q38222", to: "Q462" },
    ]) {
      report.paths.push(await inspectPaths(driver, database, measurements, pair));
    }

    if (!readOnly) {
      report.writeTest = await runIsolatedWriteTest(
        driver,
        database,
        measurements,
        beforeCounts,
      );
      report.permissions.write = report.writeTest.status === "passed";
    }
  } catch (error) {
    report.failures.push(safeError(error));
    process.exitCode = 1;
  } finally {
    report.latencyMs = summarizeLatency(measurements);
    await driver.close();
    console.log(JSON.stringify(report, null, 2));
  }
}

function parseExpectedCount(name, fallback) {
  if (!process.env[name]?.trim()) return fallback;
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

async function executeRead(driver, database, measurements, query, parameters = {}) {
  const startedAt = performance.now();
  try {
    return await driver.executeQuery(query, parameters, {
      ...(database ? { database } : {}),
      routing: neo4j.routing.READ,
      transactionConfig: { timeout: 8_000 },
    });
  } finally {
    measurements.push(performance.now() - startedAt);
  }
}

async function readServerInfo(driver, database, measurements) {
  const result = await executeRead(
    driver,
    database,
    measurements,
    "CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition",
  );
  const record = result.records[0];
  return record
    ? {
        name: record.get("name"),
        versions: record.get("versions"),
        edition: record.get("edition"),
      }
    : null;
}

async function readCounts(driver, database, measurements) {
  const result = await executeRead(
    driver,
    database,
    measurements,
    `
      MATCH (node)
      WITH count(node) AS nodes
      MATCH ()-[relationship]->()
      RETURN nodes, count(relationship) AS relationships
    `,
  );
  const record = result.records[0];
  return {
    nodes: toNumber(record.get("nodes")),
    relationships: toNumber(record.get("relationships")),
  };
}

async function readSchema(driver, database, measurements) {
  const [constraints, indexes] = await Promise.all([
    executeRead(
      driver,
      database,
      measurements,
      "SHOW CONSTRAINTS YIELD name, type, labelsOrTypes, properties RETURN name, type, labelsOrTypes, properties",
    ),
    executeRead(
      driver,
      database,
      measurements,
      "SHOW INDEXES YIELD name, state, type, labelsOrTypes, properties RETURN name, state, type, labelsOrTypes, properties",
    ),
  ]);
  const normalizedConstraints = constraints.records.map((record) => ({
    name: record.get("name"),
    type: record.get("type"),
    labelsOrTypes: record.get("labelsOrTypes"),
    properties: record.get("properties"),
  }));
  const normalizedIndexes = indexes.records.map((record) => ({
    name: record.get("name"),
    state: record.get("state"),
    type: record.get("type"),
    labelsOrTypes: record.get("labelsOrTypes"),
    properties: record.get("properties"),
  }));
  return {
    constraints: normalizedConstraints,
    indexes: normalizedIndexes,
    entityQidUniquePresent: normalizedConstraints.some(
      (constraint) =>
        constraint.type?.endsWith("UNIQUENESS") &&
        constraint.labelsOrTypes?.includes("Entity") &&
        constraint.properties?.includes("qid"),
    ),
    entityQidIndexOnline: normalizedIndexes.some(
      (index) =>
        index.state === "ONLINE" &&
        index.labelsOrTypes?.includes("Entity") &&
        index.properties?.includes("qid"),
    ),
  };
}

async function lookupQid(driver, database, measurements, entity) {
  const result = await executeRead(
    driver,
    database,
    measurements,
    `
      MATCH (entity:Entity {qid: $qid})
      RETURN entity.qid AS qid, entity.name AS name, entity.type AS type,
             entity.description AS description
      LIMIT 2
    `,
    { qid: entity.qid },
  );
  const record = result.records[0];
  return {
    qid: entity.qid,
    found: result.records.length === 1,
    unique: result.records.length <= 1,
    expectedName: entity.expectedName,
    actualName: record?.get("name") ?? null,
    type: record?.get("type") ?? null,
    hasDescription: Boolean(record?.get("description")),
  };
}

async function inspectPaths(driver, database, measurements, pair) {
  const result = await executeRead(
    driver,
    database,
    measurements,
    `
      MATCH (source:Entity {qid: $from})
      MATCH (target:Entity {qid: $to})
      MATCH path = (source)-[*1..5]-(target)
      WHERE all(node IN nodes(path) WHERE single(other IN nodes(path) WHERE other = node))
      RETURN
        [node IN nodes(path) | {qid: node.qid, name: node.name}] AS nodes,
        [relationship IN relationships(path) | {
          type: type(relationship),
          label: relationship.label,
          reverseLabel: relationship.reverseLabel,
          wikidataProperty: relationship.wikidataProperty,
          weight: relationship.weight,
          traversable: relationship.traversable
        }] AS relationships,
        length(path) AS hops,
        reduce(score = 0.0, relationship IN relationships(path) |
          score + coalesce(toFloat(relationship.weight), 1.0)
        ) + (length(path) * 0.15) AS basicScore
      ORDER BY basicScore ASC, hops ASC
      LIMIT 3
    `,
    { from: pair.from, to: pair.to },
  );
  return {
    ...pair,
    found: result.records.length > 0,
    candidates: result.records.map((record) => ({
      nodes: record.get("nodes"),
      relationships: record.get("relationships"),
      hops: toNumber(record.get("hops")),
      basicScore: record.get("basicScore"),
    })),
  };
}

async function runIsolatedWriteTest(
  driver,
  database,
  measurements,
  beforeCounts,
) {
  const validationRunId = `howconnected-free-${randomUUID()}`;
  const firstQid = `HC_VALIDATION_${randomUUID()}`;
  const secondQid = `HC_VALIDATION_${randomUUID()}`;
  let created = false;
  let verified = false;
  let cleanupError = null;

  try {
    const session = driver.session(database ? { database } : {});
    try {
      const startedAt = performance.now();
      await session.executeWrite(
        (transaction) => transaction.run(
          `
            CREATE (first:Entity:MigrationValidation {
              qid: $firstQid,
              name: "HowConnected Free validation A",
              type: "validation",
              validationRunId: $validationRunId
            })
            CREATE (second:Entity:MigrationValidation {
              qid: $secondQid,
              name: "HowConnected Free validation B",
              type: "validation",
              validationRunId: $validationRunId
            })
            CREATE (first)-[:HC_MIGRATION_VALIDATION {
              wikidataProperty: "TEST",
              label: "validation link",
              reverseLabel: "validation link",
              weight: 1.0,
              traversable: false,
              validationRunId: $validationRunId
            }]->(second)
          `,
          { validationRunId, firstQid, secondQid },
        ),
        { timeout: 8_000 },
      );
      measurements.push(performance.now() - startedAt);
      created = true;
    } finally {
      await session.close();
    }

    const verification = await executeRead(
      driver,
      database,
      measurements,
      `
        MATCH (first:MigrationValidation {validationRunId: $validationRunId})
              -[relationship:HC_MIGRATION_VALIDATION]->
              (second:MigrationValidation {validationRunId: $validationRunId})
        RETURN count(first) AS nodes, count(relationship) AS relationships,
               relationship.label AS label
      `,
      { validationRunId },
    );
    const record = verification.records[0];
    verified =
      toNumber(record.get("nodes")) === 1 &&
      toNumber(record.get("relationships")) === 1 &&
      record.get("label") === "validation link";
  } finally {
    if (created) {
      try {
        const startedAt = performance.now();
        await driver.executeQuery(
          `
            MATCH (node:MigrationValidation {validationRunId: $validationRunId})
            DETACH DELETE node
          `,
          { validationRunId },
          {
            ...(database ? { database } : {}),
            transactionConfig: { timeout: 8_000 },
          },
        );
        measurements.push(performance.now() - startedAt);
      } catch (error) {
        cleanupError = safeError(error);
      }
    }
  }

  const afterCounts = await readCounts(driver, database, measurements);
  const countsRestored =
    afterCounts.nodes === beforeCounts.nodes &&
    afterCounts.relationships === beforeCounts.relationships;
  return {
    status: verified && !cleanupError && countsRestored ? "passed" : "failed",
    created,
    verified,
    relationshipTypeCreationSupported: verified,
    cleanupSucceeded: !cleanupError,
    cleanupError,
    beforeCounts,
    afterCounts,
    countsRestored,
  };
}

function toNumber(value) {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

function summarizeLatency(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
  return {
    samples: sorted.length,
    minimum: round(sorted[0]),
    median: round(percentile(0.5)),
    p95: round(percentile(0.95)),
    maximum: round(sorted.at(-1)),
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function safeError(error) {
  if (!(error instanceof Error)) return "Unknown validation error";
  return `${error.name}: ${error.message}`
    .replaceAll(/neo4j(?:\+s)?:\/\/[^\s]+/gi, "[redacted-uri]")
    .replaceAll(/user\s+'[^']+'/gi, "user '[redacted]'")
    .replaceAll(/(?:password|credentials?)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}
