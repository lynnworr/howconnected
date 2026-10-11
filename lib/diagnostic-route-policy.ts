export const DIAGNOSTIC_NOINDEX_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function allowNeo4jDiagnosticRoute(
  nodeEnvironment: string | undefined,
): boolean {
  return nodeEnvironment !== "production";
}
