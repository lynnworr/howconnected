type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readP18Value(claim: unknown): string | null {
  if (!isJsonObject(claim) || claim.rank === "deprecated") return null;
  if (!isJsonObject(claim.mainsnak)) return null;
  if (!isJsonObject(claim.mainsnak.datavalue)) return null;
  const value = claim.mainsnak.datavalue.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractP18FileName(claims: unknown): string | null {
  if (!isJsonObject(claims) || !Array.isArray(claims.P18)) return null;

  const preferred = claims.P18.find(
    (claim) => isJsonObject(claim) && claim.rank === "preferred" && readP18Value(claim),
  );
  if (preferred) return readP18Value(preferred);

  for (const claim of claims.P18) {
    const value = readP18Value(claim);
    if (value) return value;
  }

  return null;
}

export function normalizeCommonsFileName(value: string): string {
  return value.replace(/^File:/i, "").replaceAll("_", " ").trim();
}

export function stripWikimediaHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function getEntityInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}
