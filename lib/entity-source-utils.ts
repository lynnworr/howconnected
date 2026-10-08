import type { EntitySourceData } from "./entity-source-types.ts";
import { isValidQid } from "./wikidata-id.ts";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildEnglishWikipediaUrl(title: string): string | null {
  const normalized = title.trim().replaceAll(" ", "_");
  if (!normalized) return null;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(normalized)}`;
}

export function resolveEntitySource(
  rawQid: string | null | undefined,
  sitelinks: unknown,
): EntitySourceData | null {
  const qid = rawQid?.trim().toUpperCase() ?? "";
  if (!isValidQid(qid)) return null;

  const enwiki = isJsonObject(sitelinks) && isJsonObject(sitelinks.enwiki)
    ? sitelinks.enwiki
    : null;
  const wikipediaUrl =
    enwiki && typeof enwiki.title === "string"
      ? buildEnglishWikipediaUrl(enwiki.title)
      : null;

  return {
    wikipediaUrl,
    wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
    sourceLabel: wikipediaUrl ? "Wikipedia" : "Wikidata",
  };
}
