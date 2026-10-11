import { isValidQid } from "./wikidata-id.ts";

export function isMalformedConnectionPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "connect") return false;
  if (segments.length !== 3) return true;
  return (
    !isValidQid(segments[1].toUpperCase()) ||
    !isValidQid(segments[2].toUpperCase())
  );
}
