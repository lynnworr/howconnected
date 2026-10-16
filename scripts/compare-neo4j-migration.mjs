import { createHash } from "node:crypto";
import neo4j from "neo4j-driver";

const targets = {
  professional: credentials("NEO4J"),
  free: credentials("NEO4J_FREE"),
};

const missing = Object.entries(targets).flatMap(([target, config]) =>
  config.missing.map((name) => `${target}:${name}`),
);
if (missing.length > 0) {
  console.error(`Missing required variables: ${missing.join(", ")}`);
  process.exitCode = 2;
} else {
  await compare();
}

function credentials(prefix) {
  const names = [`${prefix}_URI`, `${prefix}_USERNAME`, `${prefix}_PASSWORD`];
  return {
    uri: process.env[names[0]],
    username: process.env[names[1]],
    password: process.env[names[2]],
    missing: names.filter((name) => !process.env[name]?.trim()),
  };
}

async function compare() {
  const drivers = Object.fromEntries(
    Object.entries(targets).map(([name, config]) => [
      name,
      neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.username, config.password),
        {
          connectionAcquisitionTimeout: 10_000,
          connectionTimeout: 10_000,
          maxConnectionPoolSize: 3,
        },
      ),
    ]),
  );

  const report = {
    readOnly: true,
    capturedAt: new Date().toISOString(),
    targets: {},
    comparison: null,
    failures: [],
  };

  try {
    const [professional, free] = await Promise.all([
      capture(drivers.professional),
      capture(drivers.free),
    ]);
    report.targets = {
      professional: summarize(professional),
      free: summarize(free),
    };
    report.comparison = compareSnapshots(professional, free);
    if (!report.comparison.exactGraphContentMatch) process.exitCode = 1;
  } catch (error) {
    report.failures.push(safeError(error));
    process.exitCode = 1;
  } finally {
    await Promise.all(Object.values(drivers).map((driver) => driver.close()));
    console.log(JSON.stringify(report, null, 2));
  }
}

async function capture(driver) {
  await driver.verifyConnectivity();
  const session = driver.session();
  try {
    const snapshot = await session.executeRead(async (transaction) => {
      const counts = await transaction.run(`
        MATCH (node)
        WITH count(node) AS nodes
        MATCH ()-[relationship]->()
        RETURN nodes, count(relationship) AS relationships
      `);
      const nodes = await transaction.run(`
        MATCH (node)
        RETURN labels(node) AS labels, properties(node) AS properties
      `);
      const relationships = await transaction.run(`
        MATCH (source)-[relationship]->(target)
        RETURN source.qid AS sourceQid, target.qid AS targetQid,
               type(relationship) AS type,
               properties(relationship) AS properties
      `);
      return {
        counts: {
          nodes: toNumber(counts.records[0].get("nodes")),
          relationships: toNumber(counts.records[0].get("relationships")),
        },
        nodes: nodes.records.map((record) => ({
          labels: [...record.get("labels")].sort(),
          properties: normalize(record.get("properties")),
        })),
        relationships: relationships.records.map((record) => ({
          sourceQid: record.get("sourceQid"),
          targetQid: record.get("targetQid"),
          type: record.get("type"),
          properties: normalize(record.get("properties")),
        })),
      };
    }, { timeout: 30_000 });
    const [databaseMetadata, storeSizes] = await Promise.all([
      optionalDriverRun(driver, "SHOW DATABASES YIELD * RETURN *"),
      optionalDriverRun(
        driver,
        "CALL dbms.queryJmx('org.neo4j:instance=kernel#0,name=Store file sizes') YIELD attributes RETURN attributes",
      ),
    ]);
    return {
      ...snapshot,
      databaseMetadata: summarizeDatabaseMetadata(databaseMetadata),
      storeSizes: summarizeStoreSizes(storeSizes),
    };
  } finally {
    await session.close();
  }
}

async function optionalDriverRun(driver, query) {
  try {
    return {
      result: await driver.executeQuery(query, {}, {
        routing: neo4j.routing.READ,
        transactionConfig: { timeout: 8_000 },
      }),
      error: null,
    };
  } catch (error) {
    return { result: null, error: safeError(error) };
  }
}

function summarize(snapshot) {
  const entityNodes = snapshot.nodes.filter((node) => node.labels.includes("Entity"));
  const qids = entityNodes
    .map((node) => node.properties.qid)
    .filter((qid) => typeof qid === "string")
    .sort();
  const feedback = snapshot.nodes
    .filter((node) => node.labels.includes("PathFeedback"))
    .map(canonical)
    .sort();
  return {
    ...snapshot.counts,
    labelDistribution: distribution(snapshot.nodes.flatMap((node) => node.labels)),
    entityQids: {
      count: qids.length,
      distinct: new Set(qids).size,
      hash: hash(qids),
    },
    nodePropertyKeyDistribution: distribution(
      snapshot.nodes.flatMap((node) => Object.keys(node.properties)),
    ),
    relationshipTypeDistribution: distribution(
      snapshot.relationships.map((relationship) => relationship.type),
    ),
    relationshipPropertyKeyDistribution: distribution(
      snapshot.relationships.flatMap((relationship) =>
        Object.keys(relationship.properties),
      ),
    ),
    feedback: {
      count: feedback.length,
      contentHash: hash(feedback),
    },
    nodeContentHash: hash(snapshot.nodes.map(canonical).sort()),
    relationshipContentHash: hash(
      snapshot.relationships.map(canonical).sort(),
    ),
    databaseMetadata: snapshot.databaseMetadata,
    storeSizes: snapshot.storeSizes,
  };
}

function compareSnapshots(professional, free) {
  const professionalNodes = keyedEntityNodes(professional.nodes);
  const freeNodes = keyedEntityNodes(free.nodes);
  const professionalQids = new Set(professionalNodes.keys());
  const freeQids = new Set(freeNodes.keys());
  const missingFromFree = [...professionalQids].filter((qid) => !freeQids.has(qid));
  const extraInFree = [...freeQids].filter((qid) => !professionalQids.has(qid));
  const changedEntityProperties = [...professionalQids].filter(
    (qid) =>
      freeNodes.has(qid) &&
      canonical(professionalNodes.get(qid)) !== canonical(freeNodes.get(qid)),
  );
  const professionalRelationships = multiset(
    professional.relationships.map(canonical),
  );
  const freeRelationships = multiset(free.relationships.map(canonical));
  const relationshipDifferences = multisetDifference(
    professionalRelationships,
    freeRelationships,
  );
  const professionalSummary = summarize(professional);
  const freeSummary = summarize(free);
  const exactGraphContentMatch =
    professionalSummary.nodeContentHash === freeSummary.nodeContentHash &&
    professionalSummary.relationshipContentHash === freeSummary.relationshipContentHash;
  return {
    exactGraphContentMatch,
    countsMatch:
      professional.counts.nodes === free.counts.nodes &&
      professional.counts.relationships === free.counts.relationships,
    entityQidCoverageMatch:
      missingFromFree.length === 0 && extraInFree.length === 0,
    relationshipDistributionMatches:
      canonical(professionalSummary.relationshipTypeDistribution) ===
      canonical(freeSummary.relationshipTypeDistribution),
    propertyKeyDistributionsMatch:
      canonical(professionalSummary.nodePropertyKeyDistribution) ===
        canonical(freeSummary.nodePropertyKeyDistribution) &&
      canonical(professionalSummary.relationshipPropertyKeyDistribution) ===
        canonical(freeSummary.relationshipPropertyKeyDistribution),
    feedbackMatches:
      professionalSummary.feedback.contentHash === freeSummary.feedback.contentHash,
    missingFromFree: differenceSummary(missingFromFree),
    extraInFree: differenceSummary(extraInFree),
    changedEntityProperties: differenceSummary(changedEntityProperties),
    relationshipContentDifferences: relationshipDifferences,
  };
}

function keyedEntityNodes(nodes) {
  return new Map(
    nodes
      .filter(
        (node) =>
          node.labels.includes("Entity") && typeof node.properties.qid === "string",
      )
      .map((node) => [node.properties.qid, node]),
  );
}

function differenceSummary(values) {
  return { count: values.length, sampleQids: values.slice(0, 20).sort() };
}

function multiset(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function multisetDifference(left, right) {
  let missingFromFree = 0;
  let extraInFree = 0;
  for (const [value, count] of left) {
    missingFromFree += Math.max(0, count - (right.get(value) ?? 0));
  }
  for (const [value, count] of right) {
    extraInFree += Math.max(0, count - (left.get(value) ?? 0));
  }
  return { missingFromFree, extraInFree };
}

function summarizeDatabaseMetadata(value) {
  if (value.error) return { available: false, reason: value.error };
  const record = value.result.records.find(
    (candidate) => candidate.get("currentStatus") === "online",
  ) ?? value.result.records[0];
  if (!record) return { available: false, reason: "No database metadata returned." };
  const keys = new Set(record.keys);
  return {
    available: true,
    currentStatus: keys.has("currentStatus") ? record.get("currentStatus") : null,
    store: keys.has("store") ? record.get("store") : null,
    lastCommittedTxn: keys.has("lastCommittedTxn")
      ? normalize(record.get("lastCommittedTxn"))
      : null,
  };
}

function summarizeStoreSizes(value) {
  if (value.error) return { available: false, reason: value.error };
  const attributes = value.result.records[0]?.get("attributes");
  if (!attributes || typeof attributes !== "object") {
    return { available: false, reason: "No store-size attributes returned." };
  }
  const sizes = Object.fromEntries(
    Object.entries(attributes).flatMap(([key, item]) => {
      const raw = item && typeof item === "object" && "value" in item
        ? item.value
        : item;
      const normalized = normalize(raw);
      return typeof normalized === "number" && /size|bytes/i.test(key)
        ? [[key, normalized]]
        : [];
    }),
  );
  return Object.keys(sizes).length > 0
    ? { available: true, bytes: sizes }
    : { available: false, reason: "No numeric store-size attributes returned." };
}

function distribution(values) {
  return Object.fromEntries(
    [...multiset(values).entries()].sort(([left], [right]) =>
      String(left).localeCompare(String(right)),
    ),
  );
}

function canonical(value) {
  return JSON.stringify(normalize(value));
}

function normalize(value) {
  if (neo4j.isInt(value)) return value.inSafeRange() ? value.toNumber() : value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    if (/^(?:Date|Time|Local|Duration)/.test(value.constructor?.name ?? "")) {
      return value.toString();
    }
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }
  return value;
}

function hash(values) {
  return createHash("sha256").update(values.join("\n")).digest("hex");
}

function toNumber(value) {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

function safeError(error) {
  if (!(error instanceof Error)) return "Unknown comparison error";
  return `${error.name}: ${error.message}`
    .replaceAll(/neo4j(?:\+s)?:\/\/[^\s]+/gi, "[redacted-uri]")
    .replaceAll(/user\s+'[^']+'/gi, "user '[redacted]'")
    .replaceAll(/(?:password|credentials?)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}
