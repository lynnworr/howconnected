import { readFile } from "node:fs/promises";

const registry = JSON.parse(await readFile(new URL("../content/daily-puzzles.json", import.meta.url), "utf8"));
const userAgent = "HowConnected launch-preparation link audit (contact: project owner)";
const sources = new Map();

for (const puzzle of registry) {
  for (const node of puzzle.path) {
    if (node.wikipediaUrl) sources.set(node.wikipediaUrl, { kind: "wikipedia", publisher: "Wikipedia" });
    sources.set(node.wikidataUrl, { kind: "wikidata", publisher: "Wikidata" });
  }
  for (const relationship of puzzle.relationships) {
    for (const evidence of relationship.evidence) sources.set(evidence.url, { kind: evidence.kind, publisher: evidence.publisher });
  }
}

const entries = [...sources.entries()];
const results = [];
for (let index = 0; index < entries.length; index += 12) {
  results.push(...await Promise.all(entries.slice(index, index + 12).map(async ([url, metadata]) => {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
        headers: { "User-Agent": userAgent },
      });
      await response.body?.cancel();
      return { ...metadata, url, status: response.status, ok: response.ok, accessBlocked: [401, 403, 429].includes(response.status), transientFailure: [500, 502, 503, 504].includes(response.status) };
    } catch (error) {
      return { ...metadata, url, status: null, ok: false, accessBlocked: false, transientFailure: false, error: error instanceof Error ? error.message : String(error) };
    }
  })));
}

const accessBlocked = results.filter((result) => result.accessBlocked);
const publisherAccessBlocked = accessBlocked.filter((result) => result.kind === "supporting");
const serviceAccessLimited = accessBlocked.filter((result) => result.kind !== "supporting");
const transientFailures = results.filter((result) => result.transientFailure);
const failed = results.filter((result) => !result.ok && !result.accessBlocked && !result.transientFailure);
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  puzzles: registry.length,
  checked: results.length,
  byKind: Object.fromEntries([...new Set(results.map((result) => result.kind))].sort().map((kind) => [kind, results.filter((result) => result.kind === kind).length])),
  publisherAccessBlocked,
  publisherAccessBlockedByName: Object.fromEntries([...new Set(publisherAccessBlocked.map((result) => result.publisher))].sort().map((publisher) => [publisher, publisherAccessBlocked.filter((result) => result.publisher === publisher).length])),
  serviceAccessLimited: serviceAccessLimited.length,
  transientFailures,
  failed,
}, null, 2));
if (failed.length) process.exitCode = 2;
