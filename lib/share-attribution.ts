export const SHARE_ATTRIBUTION_PARAMETER = "source";
export const DAILY_SHARE_ATTRIBUTION = "daily_share";
export const CONNECTION_SHARE_ATTRIBUTION = "connection_share";

export type ShareAttribution =
  | typeof DAILY_SHARE_ATTRIBUTION
  | typeof CONNECTION_SHARE_ATTRIBUTION;

const ALLOWED_SHARE_ATTRIBUTIONS = new Set<ShareAttribution>([
  DAILY_SHARE_ATTRIBUTION,
  CONNECTION_SHARE_ATTRIBUTION,
]);

export function isShareAttribution(
  source: string | string[] | undefined,
  expected?: ShareAttribution,
): boolean {
  const value = Array.isArray(source) ? source[0] : source;
  if (!value || !ALLOWED_SHARE_ATTRIBUTIONS.has(value as ShareAttribution)) {
    return false;
  }
  return expected ? value === expected : true;
}

export function buildAttributedShareUrl(
  path: string,
  source: ShareAttribution,
  siteOrigin: string,
): string {
  if (!ALLOWED_SHARE_ATTRIBUTIONS.has(source)) {
    throw new Error("Unsupported share attribution source.");
  }
  const origin = new URL(siteOrigin);
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) {
    throw new Error("Share links must stay on HowConnected.");
  }
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARE_ATTRIBUTION_PARAMETER, source);
  return url.toString();
}

export function getDailyShareCopy({
  puzzleNumber,
  dateKey,
  url,
}: {
  puzzleNumber?: number;
  dateKey: string;
  url: string;
}) {
  const challenge = puzzleNumber
    ? `Challenge #${puzzleNumber}`
    : `UTC challenge ${dateKey}`;
  const text = `The Missing Link — ${challenge}\n\n✓ Completed\n\nCan you find today's hidden connection?`;
  return {
    title: "The Missing Link",
    text,
    url,
    clipboardText: `${text}\n\nPlay: ${url}`,
  };
}
