import { isValidQid } from "./wikidata-id.ts";

type ClaimEntity = {
  qid: string;
  claims: Record<string, readonly unknown[]>;
};

type CacheEntry = { parents: string[]; expiresAt: number };

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 1_000;
const MAX_DEPTH = 2;
const MAX_NODES = 40;
const COOLDOWN_MS = 60_000;
const cache = new Map<string, CacheEntry>();
let unavailableUntil = 0;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractClaimEntityQids(claims: readonly unknown[]): string[] {
  return [...new Set(claims.flatMap((claim) => {
    if (!isObject(claim) || !isObject(claim.mainsnak)) return [];
    const snak = claim.mainsnak;
    if (
      snak.snaktype !== "value" ||
      snak.datatype !== "wikibase-item" ||
      !isObject(snak.datavalue) ||
      !isObject(snak.datavalue.value) ||
      typeof snak.datavalue.value.id !== "string" ||
      !isValidQid(snak.datavalue.value.id)
    ) return [];
    return [snak.datavalue.value.id];
  }))];
}

function remember(qid: string, parents: string[], now: number): void {
  cache.delete(qid);
  cache.set(qid, { parents, expiresAt: now + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

export async function resolveWikidataTypeHierarchy(
  instanceOfQids: readonly string[],
  options: {
    fetchEntities: (qids: readonly string[]) => Promise<ClaimEntity[]>;
    now?: () => number;
    deadlineMs?: number;
  },
): Promise<string[]> {
  const now = options.now ?? Date.now;
  const seen = new Set(instanceOfQids.filter(isValidQid).slice(0, MAX_NODES));
  let frontier = [...seen];

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
    if (options.deadlineMs !== undefined && now() >= options.deadlineMs - 500) break;
    const next: string[] = [];
    const missing: string[] = [];
    for (const qid of frontier) {
      const entry = cache.get(qid);
      if (entry && entry.expiresAt > now()) next.push(...entry.parents);
      else missing.push(qid);
    }

    if (missing.length > 0 && now() >= unavailableUntil) {
      try {
        const entities = await options.fetchEntities(missing.slice(0, MAX_NODES));
        const byQid = new Map(entities.map((entity) => [entity.qid, entity]));
        for (const qid of missing) {
          const parents = extractClaimEntityQids(byQid.get(qid)?.claims.P279 ?? []);
          remember(qid, parents, now());
          next.push(...parents);
        }
      } catch (error: unknown) {
        if (error instanceof Error && /429|503|rate|timeout/i.test(error.message)) {
          unavailableUntil = now() + COOLDOWN_MS;
        }
        break;
      }
    }

    frontier = [];
    for (const qid of next) {
      if (seen.size >= MAX_NODES) break;
      if (!seen.has(qid) && isValidQid(qid)) {
        seen.add(qid);
        frontier.push(qid);
      }
    }
  }
  return [...seen];
}

export function resetTypeHierarchyCacheForTests(): void {
  cache.clear();
  unavailableUntil = 0;
}

export const TYPE_HIERARCHY_LIMITS = {
  cacheTtlMs: CACHE_TTL_MS,
  cacheMaxEntries: CACHE_MAX_ENTRIES,
  maxDepth: MAX_DEPTH,
  maxNodes: MAX_NODES,
  cooldownMs: COOLDOWN_MS,
} as const;
