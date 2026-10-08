import type {
  ConnectionPathData,
  DiscoveryResult,
} from "@/components/connection-types";
import type { EntityImageData } from "@/lib/entity-image-types";
import type { EntitySourceData } from "@/lib/entity-source-types";

export type EntityImageMap = Record<string, EntityImageData | null>;
export type EntitySourceMap = Record<string, EntitySourceData | null>;
export type EntityEnrichmentMap = {
  images: EntityImageMap;
  sources: EntitySourceMap;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntityImage(value: unknown): EntityImageData | null {
  if (!isRecord(value)) return null;
  const keys = [
    "imageUrl",
    "imageAlt",
    "commonsFileUrl",
    "artist",
    "licenseName",
    "licenseUrl",
  ] as const;
  if (keys.some((key) => typeof value[key] !== "string")) return null;

  return {
    imageUrl: value.imageUrl as string,
    imageAlt: value.imageAlt as string,
    commonsFileUrl: value.commonsFileUrl as string,
    artist: value.artist as string,
    licenseName: value.licenseName as string,
    licenseUrl: value.licenseUrl as string,
  };
}

export function parseEntityImagesResponse(value: unknown): EntityImageMap | null {
  if (!isRecord(value) || !isRecord(value.images)) return null;
  const images: EntityImageMap = {};

  for (const [qid, image] of Object.entries(value.images)) {
    if (image === null) images[qid] = null;
    else {
      const parsed = parseEntityImage(image);
      if (!parsed) return null;
      images[qid] = parsed;
    }
  }

  return images;
}

function isSafeSourceUrl(
  value: unknown,
  hostname: "en.wikipedia.org" | "www.wikidata.org",
): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === hostname;
  } catch {
    return false;
  }
}

function parseEntitySource(value: unknown): EntitySourceData | null {
  if (!isRecord(value)) return null;
  if (!isSafeSourceUrl(value.wikidataUrl, "www.wikidata.org")) return null;
  if (
    value.wikipediaUrl !== null &&
    !isSafeSourceUrl(value.wikipediaUrl, "en.wikipedia.org")
  ) {
    return null;
  }
  if (value.sourceLabel !== "Wikipedia" && value.sourceLabel !== "Wikidata") {
    return null;
  }

  return {
    wikipediaUrl: value.wikipediaUrl,
    wikidataUrl: value.wikidataUrl,
    sourceLabel: value.sourceLabel,
  };
}

export function parseEntityEnrichmentResponse(
  value: unknown,
): EntityEnrichmentMap | null {
  const images = parseEntityImagesResponse(value);
  if (!images || !isRecord(value) || !isRecord(value.sources)) return null;
  const sources: EntitySourceMap = {};

  for (const [qid, source] of Object.entries(value.sources)) {
    if (source === null) sources[qid] = null;
    else {
      const parsed = parseEntitySource(source);
      if (!parsed) return null;
      sources[qid] = parsed;
    }
  }

  return { images, sources };
}

export function enrichConnectionPath(
  path: ConnectionPathData,
  images: EntityImageMap,
  sources: EntitySourceMap = {},
): ConnectionPathData {
  return {
    ...path,
    nodes: path.nodes.map((node) => {
      const image = node.qid ? images[node.qid] : null;
      const source = node.qid ? sources[node.qid] : null;
      return {
        ...node,
        ...(image
          ? { imageUrl: image.imageUrl, imageAlt: image.imageAlt }
          : {}),
        ...(source
          ? {
              wikipediaUrl: source.wikipediaUrl ?? undefined,
              wikidataUrl: source.wikidataUrl,
              sourceLabel: source.sourceLabel,
            }
          : {}),
      };
    }),
  };
}

export function enrichDiscoveryResult(
  result: DiscoveryResult,
  images: EntityImageMap,
  sources: EntitySourceMap = {},
): DiscoveryResult {
  return {
    ...result,
    bestPath: result.bestPath
      ? enrichConnectionPath(result.bestPath, images, sources)
      : null,
    alternatePaths: result.alternatePaths.map((path) =>
      enrichConnectionPath(path, images, sources),
    ),
  };
}
