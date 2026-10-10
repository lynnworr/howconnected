import "server-only";

import { AsyncResourceCache } from "@/lib/async-resource-cache";

export { isValidQid } from "@/lib/wikidata-id";

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const REQUEST_TIMEOUT_MS = 3_000;
const ENTITY_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const ENTITY_CACHE_MAX_ENTRIES = 500;

type JsonObject = Record<string, unknown>;

export type WikidataEntitySummary = {
  qid: string;
  name: string;
  description: string;
  hasLabel: boolean;
  instanceOfQids?: string[];
};

export type WikidataEntity = WikidataEntitySummary & {
  claims: Record<string, readonly unknown[]>;
};

const entityCache = new AsyncResourceCache<string, WikidataEntity>({
  ttlMs: ENTITY_CACHE_TTL_MS,
  maxEntries: ENTITY_CACHE_MAX_ENTRIES,
});

export class WikidataFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikidataFetchError";
  }
}

export class WikidataEntityNotFoundError extends Error {
  constructor(public readonly qid: string) {
    super(`Wikidata entity ${qid} was not found.`);
    this.name = "WikidataEntityNotFoundError";
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLocalizedValue(value: unknown): string | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }

  const english = value.en;
  if (isJsonObject(english) && typeof english.value === "string") {
    return english.value;
  }

  for (const term of Object.values(value)) {
    if (isJsonObject(term) && typeof term.value === "string") {
      return term.value;
    }
  }

  return undefined;
}

function readClaims(value: unknown): Record<string, readonly unknown[]> {
  if (!isJsonObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, unknown[]] =>
      Array.isArray(entry[1]),
    ),
  );
}

function readEntityQids(claims: readonly unknown[]): string[] {
  return [...new Set(claims.flatMap((claim) => {
    if (!isJsonObject(claim) || !isJsonObject(claim.mainsnak)) return [];
    const snak = claim.mainsnak;
    if (
      snak.snaktype !== "value" ||
      snak.datatype !== "wikibase-item" ||
      !isJsonObject(snak.datavalue) ||
      !isJsonObject(snak.datavalue.value) ||
      typeof snak.datavalue.value.id !== "string"
    ) return [];
    return [snak.datavalue.value.id];
  }))];
}

async function fetchEntityRecords(
  qids: readonly string[],
  includeClaims: boolean,
): Promise<Record<string, unknown>> {
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: includeClaims ? "labels|descriptions|claims" : "labels|descriptions",
    languages: "en",
    languagefallback: "1",
    format: "json",
    formatversion: "2",
  }).toString();

  let response: Response;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResponse = new Promise<Response>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new WikidataFetchError("Wikidata request timed out."));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    response = await Promise.race([
      fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent":
            "connections-lab/0.1 (https://connections-lab.vercel.app; controlled Wikidata ingestion)",
        },
      }),
      timeoutResponse,
    ]);
  } catch (error: unknown) {
    throw new WikidataFetchError(
      error instanceof Error ? error.message : "Wikidata request failed.",
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new WikidataFetchError(
      `Wikidata returned HTTP ${response.status}.`,
    );
  }

  const data: unknown = await response.json();
  if (!isJsonObject(data) || !isJsonObject(data.entities)) {
    throw new WikidataFetchError("Wikidata returned an invalid response.");
  }

  return data.entities;
}

function normalizeSummary(
  qid: string,
  value: unknown,
  includeTypes = false,
): WikidataEntitySummary {
  if (!isJsonObject(value) || value.missing !== undefined) {
    return { qid, name: qid, description: "", hasLabel: false };
  }

  const label = readLocalizedValue(value.labels);

  const claims = includeTypes ? readClaims(value.claims) : {};
  return {
    qid,
    name: label ?? qid,
    description: readLocalizedValue(value.descriptions) ?? "",
    hasLabel: label !== undefined,
    ...(includeTypes ? { instanceOfQids: readEntityQids(claims.P31 ?? []) } : {}),
  };
}

export async function fetchWikidataEntity(qid: string): Promise<WikidataEntity> {
  return entityCache.get(qid, async () => {
    const records = await fetchEntityRecords([qid], true);
    const value = records[qid];

    if (!isJsonObject(value) || value.missing !== undefined) {
      throw new WikidataEntityNotFoundError(qid);
    }

    return {
      ...normalizeSummary(qid, value),
      claims: readClaims(value.claims),
    };
  });
}

export async function fetchWikidataEntitySummaries(
  qids: readonly string[],
  options: { includeTypes?: boolean } = {},
): Promise<WikidataEntitySummary[]> {
  const uniqueQids = [...new Set(qids)];
  if (uniqueQids.length === 0) {
    return [];
  }

  const records = await fetchEntityRecords(uniqueQids, options.includeTypes === true);
  return uniqueQids.map((qid) =>
    normalizeSummary(qid, records[qid], options.includeTypes === true),
  );
}

export async function fetchWikidataEntities(
  qids: readonly string[],
): Promise<WikidataEntity[]> {
  const uniqueQids = [...new Set(qids)];
  if (uniqueQids.length === 0) return [];
  const records = await fetchEntityRecords(uniqueQids, true);
  return uniqueQids.flatMap((qid) => {
    const value = records[qid];
    if (!isJsonObject(value) || value.missing !== undefined) return [];
    return [{ ...normalizeSummary(qid, value), claims: readClaims(value.claims) }];
  });
}
