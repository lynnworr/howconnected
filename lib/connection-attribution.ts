export type ConnectionOrigin = "homepage" | "shared_url" | "extension";

export const EXTENSION_ATTRIBUTION_PARAMETER = "source";
export const EXTENSION_ATTRIBUTION_VALUE = "extension";

export function isExtensionAttribution(
  source: string | string[] | undefined,
): boolean {
  const value = Array.isArray(source) ? source[0] : source;
  return value === EXTENSION_ATTRIBUTION_VALUE;
}

export function getConnectionOrigin(
  source: string | string[] | undefined,
): ConnectionOrigin {
  return isExtensionAttribution(source) ? "extension" : "shared_url";
}
