import { isValidQid } from "./wikidata-id.ts";
import type { WikidataPropertyConfig } from "./wikidata-properties.ts";
import { classifyEntityDomain } from "./entity-domain.ts";
import { selectIncomingDiscoveryProperties } from "./discovery-policy.ts";

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const REQUEST_TIMEOUT_MS = 1_500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 500;
const MAX_REVERSE_PROPERTIES_PER_ENTITY = 3;
export const REVERSE_DISCOVERY_VERSION = 4;
const USER_AGENT =
  "connections-lab/0.1 (https://connections-lab.vercel.app; bounded reverse discovery)";

type CacheEntry = {
  qids: string[];
  expiresAt: number;
};

type SearchResponse = {
  query?: {
    search?: Array<{ title?: unknown }>;
  };
};

export type IncomingLookupResult = {
  qids: string[];
  status: "ok" | "unavailable";
  cached: boolean;
  reason?: "rate-limited" | "timeout" | "upstream-error" | "invalid-response";
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<IncomingLookupResult>>();
let rateLimitedUntil = 0;

function cacheKey(qid: string, propertyId: string): string {
  return `${propertyId}:${qid}`;
}

function remember(key: string, qids: string[], now: number): void {
  cache.delete(key);
  cache.set(key, { qids, expiresAt: now + CACHE_TTL_MS });

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

function readRetryAfter(value: string | null, now: number): number {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1_000, date - now) : 60_000;
}

export function normalizeIncomingSearchResults(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  const search = (value as SearchResponse).query?.search;
  if (!Array.isArray(search)) return [];

  return [
    ...new Set(
      search.flatMap((item) =>
        typeof item.title === "string" && isValidQid(item.title)
          ? [item.title]
          : [],
      ),
    ),
  ];
}

async function performLookup(
  qid: string,
  property: WikidataPropertyConfig,
  fetchImpl: typeof fetch,
  now: () => number,
): Promise<IncomingLookupResult> {
  if (now() < rateLimitedUntil) {
    return { qids: [], status: "unavailable", cached: false, reason: "rate-limited" };
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResponse = new Promise<Response>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new DOMException("Wikidata reverse lookup timed out.", "AbortError"));
    }, REQUEST_TIMEOUT_MS);
  });
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `haswbstatement:${property.wikidataProperty}=${qid}`,
    srnamespace: "0",
    srlimit: String(property.reverseDiscoveryFanout ?? 3),
    srprop: "",
    maxlag: "5",
    format: "json",
    formatversion: "2",
  }).toString();

  try {
    const response = await Promise.race([
      fetchImpl(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      }),
      timeoutResponse,
    ]);

    if (response.status === 429) {
      rateLimitedUntil = now() + readRetryAfter(response.headers.get("Retry-After"), now());
      return { qids: [], status: "unavailable", cached: false, reason: "rate-limited" };
    }
    if (!response.ok) {
      return { qids: [], status: "unavailable", cached: false, reason: "upstream-error" };
    }

    const qids = normalizeIncomingSearchResults(await response.json()).slice(
      0,
      property.reverseDiscoveryFanout ?? 3,
    );
    remember(cacheKey(qid, property.wikidataProperty), qids, now());
    return { qids, status: "ok", cached: false };
  } catch (error: unknown) {
    return {
      qids: [],
      status: "unavailable",
      cached: false,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "upstream-error",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function fetchIncomingWikidataEntities(
  qid: string,
  property: WikidataPropertyConfig,
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<IncomingLookupResult> {
  if (!isValidQid(qid) || !property.reverseDiscoveryEnabled) {
    return Promise.resolve({ qids: [], status: "ok", cached: false });
  }

  const now = options.now ?? Date.now;
  const key = cacheKey(qid, property.wikidataProperty);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now()) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve({ qids: [...cached.qids], status: "ok", cached: true });
  }
  if (cached) cache.delete(key);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = performLookup(qid, property, options.fetchImpl ?? fetch, now).finally(
    () => inFlight.delete(key),
  );
  inFlight.set(key, request);
  return request;
}

export function selectReverseDiscoveryProperties(
  entity: { type: string; description: string },
  properties: readonly WikidataPropertyConfig[],
): WikidataPropertyConfig[] {
  const domain = classifyEntityDomain(entity);
  const available = selectIncomingDiscoveryProperties(
    domain,
    properties,
    properties.length,
  );
  const value = `${entity.type} ${entity.description}`.toLowerCase();
  const preferred: string[] = [];

  if (domain === "person") {
    if (/actor|actress|comedian|voice actor/.test(value)) preferred.push("P161", "P725");
    if (/director|filmmaker/.test(value)) preferred.push("P57");
    if (/screenwriter|writer|author|novelist/.test(value)) preferred.push("P58", "P50");
    if (/singer|musician|performer|composer/.test(value)) preferred.push("P175", "P86");
    if (/architect/.test(value)) preferred.push("P84");
    if (/producer/.test(value)) preferred.push("P1431", "P162");
    if (/founder|entrepreneur/.test(value)) preferred.push("P112");
    if (/executive|chief executive|ceo/.test(value)) preferred.push("P169");
  } else if (domain === "company/organization") {
    if (/studio|media|film|television|network|broadcaster|production/.test(value)) {
      preferred.push("P272", "P449", "P750");
    } else {
      preferred.push("P176", "P108", "P859", "P463");
    }
  }

  const preferredOrder = new Map(
    preferred.map((propertyId, index) => [propertyId, index]),
  );
  return [...available]
    .sort(
      (left, right) =>
        (preferredOrder.get(left.wikidataProperty) ?? Number.MAX_SAFE_INTEGER) -
        (preferredOrder.get(right.wikidataProperty) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, MAX_REVERSE_PROPERTIES_PER_ENTITY);
}

export function resetIncomingLookupStateForTests(): void {
  cache.clear();
  inFlight.clear();
  rateLimitedUntil = 0;
}

export const INCOMING_LOOKUP_LIMITS = {
  cacheTtlMs: CACHE_TTL_MS,
  cacheMaxEntries: CACHE_MAX_ENTRIES,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  maxPropertiesPerEntity: MAX_REVERSE_PROPERTIES_PER_ENTITY,
} as const;
