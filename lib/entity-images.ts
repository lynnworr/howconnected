import "server-only";

import type { EntityImageData } from "@/lib/entity-image-types";
import type { EntitySourceData } from "@/lib/entity-source-types";
import { resolveEntitySource } from "@/lib/entity-source-utils";
import {
  extractP18FileName,
  normalizeCommonsFileName,
  stripWikimediaHtml,
} from "@/lib/entity-image-utils";

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_QIDS_PER_REQUEST = 12;
const WIKIMEDIA_IMAGE_HOSTS = new Set([
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
]);
const COMMONS_PAGE_HOSTS = new Set(["commons.wikimedia.org"]);

type JsonObject = Record<string, unknown>;
type CacheEntry = {
  expiresAt: number;
  image: EntityImageData | null;
  source: EntitySourceData | null;
};
type EntityLookupSource = {
  fileName: string | null;
  entityName: string;
  source: EntitySourceData | null;
};

const enrichmentCache = new Map<string, CacheEntry>();

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchJson(url: URL): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "connections-lab/0.1 (https://connections-lab.vercel.app; Wikimedia entity media)",
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error: unknown) {
      if (attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    if (response.ok) return response.json();
    if (attempt === 1 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`Wikimedia returned HTTP ${response.status}.`);
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delay =
      response.status === 429 && Number.isFinite(retryAfterSeconds)
        ? Math.min(10_000, Math.max(1_000, retryAfterSeconds * 1_000))
        : 250;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("Wikimedia image request failed.");
}

function readEnglishLabel(value: unknown, fallback: string): string {
  if (!isJsonObject(value) || !isJsonObject(value.en)) return fallback;
  return typeof value.en.value === "string" ? value.en.value : fallback;
}

async function fetchEntitySources(qids: string[]) {
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "claims|labels|sitelinks",
    sitefilter: "enwiki",
    languages: "en",
    languagefallback: "1",
    format: "json",
    formatversion: "2",
  }).toString();

  const data = await fetchJson(url);
  if (!isJsonObject(data) || !isJsonObject(data.entities)) {
    throw new Error("Wikidata returned an invalid image response.");
  }

  const sources = new Map<string, EntityLookupSource>();
  for (const qid of qids) {
    const entity = data.entities[qid];
    if (!isJsonObject(entity)) continue;
    const fileName = extractP18FileName(entity.claims);
    sources.set(qid, {
      fileName: fileName ? normalizeCommonsFileName(fileName) : null,
      entityName: readEnglishLabel(entity.labels, qid),
      source: resolveEntitySource(qid, entity.sitelinks),
    });
  }
  return sources;
}

function readMetadataValue(metadata: unknown, key: string): string {
  if (!isJsonObject(metadata) || !isJsonObject(metadata[key])) return "";
  const value = metadata[key].value;
  return typeof value === "string" ? value.trim() : "";
}

function safeHttpUrl(value: unknown, allowedHosts?: ReadonlySet<string>): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (allowedHosts && !allowedHosts.has(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchCommonsImages(sources: Map<string, EntityLookupSource>) {
  const fileNames = [
    ...new Set(
      [...sources.values()]
        .map((source) => source.fileName)
        .filter((fileName): fileName is string => fileName !== null),
    ),
  ];
  if (fileNames.length === 0) return new Map<string, EntityImageData>();

  const url = new URL(COMMONS_API_URL);
  url.search = new URLSearchParams({
    action: "query",
    prop: "imageinfo",
    titles: fileNames.map((name) => `File:${name}`).join("|"),
    iiprop: "url|extmetadata",
    iiurlwidth: "320",
    iiextmetadatalanguage: "en",
    iiextmetadatafilter:
      "Artist|Credit|LicenseShortName|LicenseUrl|AttributionRequired|NonFree|Restrictions",
    format: "json",
    formatversion: "2",
  }).toString();

  const data = await fetchJson(url);
  if (!isJsonObject(data) || !isJsonObject(data.query) || !Array.isArray(data.query.pages)) {
    throw new Error("Commons returned an invalid image response.");
  }

  const imageByFile = new Map<string, EntityImageData>();
  for (const page of data.query.pages) {
    if (!isJsonObject(page) || typeof page.title !== "string") continue;
    if (!Array.isArray(page.imageinfo) || !isJsonObject(page.imageinfo[0])) continue;
    const info = page.imageinfo[0];
    const imageUrl = safeHttpUrl(
      info.thumburl,
      WIKIMEDIA_IMAGE_HOSTS,
    );
    const commonsFileUrl = safeHttpUrl(
      info.descriptionurl,
      COMMONS_PAGE_HOSTS,
    );
    const licenseName = stripWikimediaHtml(
      readMetadataValue(info.extmetadata, "LicenseShortName"),
    );
    const licenseUrl =
      safeHttpUrl(readMetadataValue(info.extmetadata, "LicenseUrl")) ||
      commonsFileUrl;
    const nonFree = readMetadataValue(info.extmetadata, "NonFree").toLowerCase();

    if (
      !imageUrl ||
      !commonsFileUrl ||
      !licenseName ||
      !licenseUrl ||
      nonFree === "true" ||
      nonFree === "1"
    ) {
      continue;
    }

    const artist =
      stripWikimediaHtml(readMetadataValue(info.extmetadata, "Artist")) ||
      stripWikimediaHtml(readMetadataValue(info.extmetadata, "Credit")) ||
      "Wikimedia Commons contributor";
    const fileName = normalizeCommonsFileName(page.title);
    imageByFile.set(fileName, {
      imageUrl,
      imageAlt: "",
      commonsFileUrl,
      artist,
      licenseName,
      licenseUrl,
    });
  }

  const images = new Map<string, EntityImageData>();
  for (const [qid, source] of sources) {
    if (!source.fileName) continue;
    const image = imageByFile.get(source.fileName);
    if (!image) continue;
    images.set(qid, {
      ...image,
      imageAlt: `Image of ${source.entityName}`,
    });
  }
  return images;
}

function setCachedEnrichment(
  qid: string,
  image: EntityImageData | null,
  source: EntitySourceData | null,
) {
  const now = Date.now();
  for (const [cachedQid, cached] of enrichmentCache) {
    if (cached.expiresAt <= now) enrichmentCache.delete(cachedQid);
  }
  if (enrichmentCache.size >= MAX_CACHE_ENTRIES) {
    const oldestQid = enrichmentCache.keys().next().value;
    if (typeof oldestQid === "string") enrichmentCache.delete(oldestQid);
  }
  enrichmentCache.set(qid, {
    expiresAt: now + CACHE_TTL_MS,
    image,
    source,
  });
}

export async function resolveEntityEnrichment(
  requestedQids: readonly string[],
): Promise<{
  images: Record<string, EntityImageData | null>;
  sources: Record<string, EntitySourceData | null>;
}> {
  const qids = [...new Set(requestedQids)].slice(0, MAX_QIDS_PER_REQUEST);
  const images: Record<string, EntityImageData | null> = {};
  const sources: Record<string, EntitySourceData | null> = {};
  const missing: string[] = [];

  for (const qid of qids) {
    const cached = enrichmentCache.get(qid);
    if (cached && cached.expiresAt > Date.now()) {
      images[qid] = cached.image;
      sources[qid] = cached.source;
    } else {
      missing.push(qid);
    }
  }

  if (missing.length > 0) {
    const entitySources = await fetchEntitySources(missing);
    const resolvedImages = await fetchCommonsImages(entitySources);
    for (const qid of missing) {
      const image = resolvedImages.get(qid) ?? null;
      const source =
        entitySources.get(qid)?.source ?? resolveEntitySource(qid, null);
      setCachedEnrichment(qid, image, source);
      images[qid] = image;
      sources[qid] = source;
    }
  }

  return { images, sources };
}
