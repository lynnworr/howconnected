import "server-only";

import {
  rankSearchCandidates,
  type SearchRankingCandidate,
} from "@/lib/search-ranking";
import { withOptionalSearchEnrichment } from "@/lib/search-pipeline";

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const CACHE_TTL_MS = 60 * 60 * 1000;
const STALE_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 250;
const REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 5_000;

type JsonObject = Record<string, unknown>;

export type EntitySearchResult = {
  id: string;
  label: string;
  description: string;
  url: string;
};

type CachedSearch = {
  expiresAt: number;
  staleUntil: number;
  results: EntitySearchResult[];
};

const searchCache = new Map<string, CachedSearch>();
const pendingSearches = new Map<string, Promise<EntitySearchResult[]>>();
let rateLimitedUntil = 0;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function retryAfterMilliseconds(value: string | null): number {
  if (!value) return DEFAULT_RATE_LIMIT_COOLDOWN_MS;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(1_000, date - Date.now())
    : DEFAULT_RATE_LIMIT_COOLDOWN_MS;
}

async function fetchJson(url: URL): Promise<unknown> {
  if (Date.now() < rateLimitedUntil) {
    throw new Error("Wikimedia search is temporarily rate limited.");
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "connections-lab/0.1 (https://connections-lab.vercel.app; Wikidata entity autocomplete)",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.ok) return response.json();
  if (response.status === 429 || response.status === 503) {
    rateLimitedUntil =
      Date.now() + retryAfterMilliseconds(response.headers.get("retry-after"));
  }
  throw new Error(`Wikimedia returned HTTP ${response.status}.`);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function fetchWikidataCandidates(
  query: string,
): Promise<Array<SearchRankingCandidate & EntitySearchResult>> {
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "30",
    format: "json",
  }).toString();
  const data = await fetchJson(url);

  if (!isJsonObject(data) || !Array.isArray(data.search)) {
    throw new Error("Wikidata returned an invalid search response.");
  }

  return data.search.flatMap(
    (value, index): Array<SearchRankingCandidate & EntitySearchResult> => {
      if (
        !isJsonObject(value) ||
        typeof value.id !== "string" ||
        !/^Q[1-9]\d*$/.test(value.id) ||
        typeof value.label !== "string"
      ) {
        return [];
      }

      const aliases = readStringArray(value.aliases);
      if (
        isJsonObject(value.match) &&
        value.match.type === "alias" &&
        typeof value.match.text === "string"
      ) {
        aliases.push(value.match.text);
      }

      return [
        {
          id: value.id,
          label: value.label,
          description:
            typeof value.description === "string" ? value.description : "",
          aliases: [...new Set(aliases)],
          wikidataRank: index,
          url: `https://www.wikidata.org/entity/${value.id}`,
        },
      ];
    },
  );
}

function cacheResults(key: string, results: EntitySearchResult[]) {
  const now = Date.now();
  for (const [cachedKey, cached] of searchCache) {
    if (cached.staleUntil <= now) searchCache.delete(cachedKey);
  }
  searchCache.delete(key);
  while (searchCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (typeof oldestKey === "string") searchCache.delete(oldestKey);
    else break;
  }

  searchCache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    staleUntil: now + STALE_FALLBACK_TTL_MS,
    results,
  });
}

function cachedResults(key: string, allowStale: boolean) {
  const cached = searchCache.get(key);
  if (!cached) return null;
  const validUntil = allowStale ? cached.staleUntil : cached.expiresAt;
  if (validUntil <= Date.now()) {
    searchCache.delete(key);
    return null;
  }

  searchCache.delete(key);
  searchCache.set(key, cached);
  return cached.results;
}

async function performSearch(query: string, cacheKey: string) {
  const candidates = await withOptionalSearchEnrichment(() =>
    fetchWikidataCandidates(query),
  );
  const results = rankSearchCandidates(query, candidates)
    .slice(0, 8)
    .map(({ id, label, description, url }) => ({ id, label, description, url }));

  cacheResults(cacheKey, results);
  return results;
}

export async function searchEntities(query: string): Promise<EntitySearchResult[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const cacheKey = normalizedQuery.normalize("NFKC").toLocaleLowerCase("en");
  const cached = cachedResults(cacheKey, false);
  if (cached) return cached;

  const pending = pendingSearches.get(cacheKey);
  if (pending) return pending;

  const search = performSearch(normalizedQuery, cacheKey)
    .catch((error: unknown) => {
      const stale = cachedResults(cacheKey, true);
      if (stale) return stale;
      throw error;
    })
    .finally(() => {
      pendingSearches.delete(cacheKey);
    });
  pendingSearches.set(cacheKey, search);
  return search;
}
