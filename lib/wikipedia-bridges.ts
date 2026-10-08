import { isValidQid } from "./wikidata-id.ts";
import { classifyEntityDomain, type EntityDomain } from "./entity-domain.ts";

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const ENWIKI_API_URL = "https://en.wikipedia.org/w/api.php";
const USER_AGENT =
  "connections-lab/0.1 (https://connections-lab.vercel.app; bounded bridge discovery)";
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 300;
const DEFAULT_REQUEST_TIMEOUT_MS = 2_000;
export const DEFAULT_WIKIPEDIA_LINK_CAP = 20;

type JsonObject = Record<string, unknown>;

type CachedCandidates = {
  candidates: WikipediaBridgeCandidate[];
  expiresAt: number;
};

export type WikipediaBridgeCandidate = {
  qid: string;
  title: string;
  shared: boolean;
  domain?: EntityDomain;
};

export type WikipediaBridgeResult = {
  source: WikipediaBridgeCandidate[];
  target: WikipediaBridgeCandidate[];
  status: "ok" | "partial" | "unavailable";
};

type BridgeOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  perSideCap?: number;
  requestTimeoutMs?: number;
  deadlineMs?: number;
};

const cache = new Map<string, CachedCandidates>();
const inFlight = new Map<string, Promise<WikipediaBridgeCandidate[]>>();
let rateLimitedUntil = 0;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return isJsonObject(value) ? Object.values(value) : [];
}

function remember(qid: string, candidates: WikipediaBridgeCandidate[], now: number) {
  cache.delete(qid);
  cache.set(qid, { candidates, expiresAt: now + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

function readCached(qid: string, now: number): WikipediaBridgeCandidate[] | null {
  const entry = cache.get(qid);
  if (!entry || entry.expiresAt <= now) {
    if (entry) cache.delete(qid);
    return null;
  }
  cache.delete(qid);
  cache.set(qid, entry);
  return entry.candidates.map((candidate) => ({ ...candidate }));
}

function retryAfterMs(value: string | null, now: number): number {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1_000, date - now) : 60_000;
}

async function fetchJson(
  url: URL,
  fetchImpl: typeof fetch,
  now: () => number,
  timeoutMs: number,
  deadlineMs?: number,
): Promise<unknown> {
  if (now() < rateLimitedUntil) throw new Error("Wikimedia rate-limit cooldown active.");
  const remainingMs = deadlineMs === undefined ? timeoutMs : deadlineMs - now();
  if (remainingMs <= 0) throw new Error("Bridge discovery deadline reached.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, remainingMs));
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (response.status === 429) {
      rateLimitedUntil = now() + retryAfterMs(response.headers.get("Retry-After"), now());
      throw new Error("Wikimedia rate limited bridge discovery.");
    }
    if (!response.ok) throw new Error(`Wikimedia returned HTTP ${response.status}.`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeWikipediaPageCandidates(
  value: unknown,
  limit: number,
): WikipediaBridgeCandidate[] {
  if (!isJsonObject(value) || !isJsonObject(value.query)) return [];
  const pages = value.query.pages;
  if (!Array.isArray(pages)) return [];

  const candidates = new Map<string, WikipediaBridgeCandidate>();
  for (const page of pages) {
    if (!isJsonObject(page) || typeof page.title !== "string") continue;
    const pageprops = page.pageprops;
    const qid = isJsonObject(pageprops) ? pageprops.wikibase_item : undefined;
    if (typeof qid !== "string" || !isValidQid(qid)) continue;
    if (!candidates.has(qid)) {
      candidates.set(qid, { qid, title: page.title, shared: false });
    }
  }
  return [...candidates.values()].slice(0, Math.max(0, limit));
}

function readEnglishSitelinks(value: unknown): ReadonlyMap<string, string> {
  if (!isJsonObject(value)) return new Map();
  const entries: Array<[string, string]> = [];
  for (const entity of recordValues(value.entities)) {
    if (!isJsonObject(entity) || typeof entity.id !== "string") continue;
    const sitelinks = entity.sitelinks;
    const enwiki = isJsonObject(sitelinks) ? sitelinks.enwiki : undefined;
    if (isJsonObject(enwiki) && typeof enwiki.title === "string") {
      entries.push([entity.id, enwiki.title]);
    }
  }
  return new Map(entries);
}

async function fetchSitelinks(
  qids: string[],
  fetchImpl: typeof fetch,
  now: () => number,
  timeoutMs: number,
  deadlineMs?: number,
): Promise<ReadonlyMap<string, string>> {
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "sitelinks",
    sitefilter: "enwiki",
    format: "json",
    formatversion: "2",
  }).toString();
  return readEnglishSitelinks(
    await fetchJson(url, fetchImpl, now, timeoutMs, deadlineMs),
  );
}

async function fetchLinkedCandidates(
  title: string,
  limit: number,
  fetchImpl: typeof fetch,
  now: () => number,
  timeoutMs: number,
  deadlineMs?: number,
): Promise<WikipediaBridgeCandidate[]> {
  const url = new URL(ENWIKI_API_URL);
  url.search = new URLSearchParams({
    action: "query",
    generator: "links",
    titles: title,
    gplnamespace: "0",
    gpllimit: String(limit),
    prop: "pageprops",
    ppprop: "wikibase_item",
    redirects: "1",
    format: "json",
    formatversion: "2",
  }).toString();
  return normalizeWikipediaPageCandidates(
    await fetchJson(url, fetchImpl, now, timeoutMs, deadlineMs),
    limit,
  );
}

async function fetchCandidateDomains(
  qids: string[],
  fetchImpl: typeof fetch,
  now: () => number,
  timeoutMs: number,
  deadlineMs?: number,
): Promise<ReadonlyMap<string, EntityDomain>> {
  if (qids.length === 0) return new Map();
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "labels|descriptions",
    languages: "en",
    languagefallback: "1",
    format: "json",
    formatversion: "2",
  }).toString();
  const value = await fetchJson(url, fetchImpl, now, timeoutMs, deadlineMs);
  if (!isJsonObject(value)) return new Map();
  const domains: Array<[string, EntityDomain]> = [];
  for (const entity of recordValues(value.entities)) {
    if (!isJsonObject(entity) || typeof entity.id !== "string") continue;
    const descriptions = entity.descriptions;
    const english = isJsonObject(descriptions) ? descriptions.en : undefined;
    const description =
      isJsonObject(english) && typeof english.value === "string" ? english.value : "";
    domains.push([
      entity.id,
      classifyEntityDomain({ description }),
    ]);
  }
  return new Map(domains);
}

export async function findWikipediaBridgeCandidates(
  sourceQid: string,
  targetQid: string,
  options: BridgeOptions = {},
): Promise<WikipediaBridgeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const limit = Math.min(
    DEFAULT_WIKIPEDIA_LINK_CAP,
    Math.max(1, options.perSideCap ?? DEFAULT_WIKIPEDIA_LINK_CAP),
  );
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs;
  const roots = [sourceQid, targetQid];
  const cached = new Map(
    roots.flatMap((qid) => {
      const candidates = readCached(qid, now());
      return candidates ? [[qid, candidates] as const] : [];
    }),
  );
  let fetchedAny = false;

  try {
    const missing = roots.filter((qid) => !cached.has(qid));
    const sitelinks = missing.length
      ? await fetchSitelinks(missing, fetchImpl, now, timeoutMs, deadlineMs)
      : new Map<string, string>();

    const fetched = await Promise.all(
      missing.map(async (qid) => {
        const existing = inFlight.get(qid);
        const title = sitelinks.get(qid);
        const request = existing ??
          (title
            ? fetchLinkedCandidates(
                title,
                limit,
                fetchImpl,
                now,
                timeoutMs,
                deadlineMs,
              ).finally(
                () => inFlight.delete(qid),
              )
            : Promise.resolve([]));
        if (!existing && title) inFlight.set(qid, request);
        return [qid, await request] as const;
      }),
    );
    fetchedAny = fetched.length > 0;
    for (const [qid, candidates] of fetched) {
      cached.set(qid, candidates);
      remember(qid, candidates, now());
    }

    if (fetchedAny) {
      const candidateQids = [
        ...new Set([...cached.values()].flat().map(({ qid }) => qid)),
      ];
      const domains = await fetchCandidateDomains(
        candidateQids,
        fetchImpl,
        now,
        timeoutMs,
        deadlineMs,
      );
      for (const [qid, candidates] of cached) {
        const enriched = candidates.map((candidate) => ({
          ...candidate,
          domain: domains.get(candidate.qid) ?? "entity",
        }));
        cached.set(qid, enriched);
        remember(qid, enriched, now());
      }
    }
  } catch {
    // Stage C is optional. Preserve any complete cached side and skip unavailable work.
  }

  const source = (cached.get(sourceQid) ?? []).slice(0, limit);
  const target = (cached.get(targetQid) ?? []).slice(0, limit);
  const sourceQids = new Set(source.map(({ qid }) => qid));
  const targetQids = new Set(target.map(({ qid }) => qid));
  const withShared = (items: WikipediaBridgeCandidate[], opposite: Set<string>) =>
    items.map((item) => ({ ...item, shared: opposite.has(item.qid) }));

  return {
    source: withShared(source, targetQids),
    target: withShared(target, sourceQids),
    status:
      source.length > 0 && target.length > 0
        ? "ok"
        : source.length > 0 || target.length > 0
          ? "partial"
          : "unavailable",
  };
}

export function resetWikipediaBridgeStateForTests(): void {
  cache.clear();
  inFlight.clear();
  rateLimitedUntil = 0;
}

export const WIKIPEDIA_BRIDGE_LIMITS = {
  perSide: DEFAULT_WIKIPEDIA_LINK_CAP,
  cacheTtlMs: CACHE_TTL_MS,
  cacheMaxEntries: CACHE_MAX_ENTRIES,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
} as const;
