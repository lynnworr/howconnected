import {
  CONNECTION_SHARE_ATTRIBUTION,
  DAILY_SHARE_ATTRIBUTION,
  isShareAttribution,
} from "./share-attribution.ts";

export type ConnectionOrigin =
  | "homepage"
  | "shared_url"
  | "extension"
  | "connection_share"
  | "publisher_widget"
  | "trending_homepage";
export type DailyOrigin = "extension" | "daily_share";

export const EXTENSION_ATTRIBUTION_PARAMETER = "source";
export const EXTENSION_ATTRIBUTION_VALUE = "extension";
export const PUBLISHER_WIDGET_ATTRIBUTION_VALUE = "publisher_widget";

export function isExtensionAttribution(
  source: string | string[] | undefined,
): boolean {
  const value = Array.isArray(source) ? source[0] : source;
  return value === EXTENSION_ATTRIBUTION_VALUE;
}

export function getConnectionOrigin(
  source: string | string[] | undefined,
): ConnectionOrigin {
  if (isExtensionAttribution(source)) return "extension";
  const value = Array.isArray(source) ? source[0] : source;
  if (value === PUBLISHER_WIDGET_ATTRIBUTION_VALUE) return "publisher_widget";
  if (value === "trending_homepage") return "trending_homepage";
  if (isShareAttribution(source, CONNECTION_SHARE_ATTRIBUTION)) {
    return "connection_share";
  }
  return "shared_url";
}

export function getDailyOrigin(
  source: string | string[] | undefined,
): DailyOrigin | undefined {
  if (isExtensionAttribution(source)) return "extension";
  if (isShareAttribution(source, DAILY_SHARE_ATTRIBUTION)) {
    return "daily_share";
  }
  return undefined;
}
