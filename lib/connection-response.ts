import type {
  ConnectionNode,
  ConnectionPathData,
  ConnectionRelationship,
  DiscoveryResult,
} from "@/components/connection-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNode(value: unknown): ConnectionNode | null {
  if (!isRecord(value) || typeof value.name !== "string") return null;

  return {
    name: value.name,
    type: typeof value.type === "string" ? value.type : "entity",
    qid: typeof value.qid === "string" ? value.qid : null,
  };
}

function parseRelationship(value: unknown): ConnectionRelationship | null {
  if (!isRecord(value) || typeof value.label !== "string") return null;

  return {
    label: value.label,
    from: typeof value.from === "string" ? value.from : "",
    to: typeof value.to === "string" ? value.to : "",
  };
}

function parsePath(value: unknown): ConnectionPathData | null {
  if (
    !isRecord(value) ||
    typeof value.steps !== "number" ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.relationships)
  ) {
    return null;
  }

  const nodes = value.nodes.map(parseNode);
  const relationships = value.relationships.map(parseRelationship);
  if (
    nodes.some((node) => node === null) ||
    relationships.some((relationship) => relationship === null)
  ) {
    return null;
  }

  return {
    steps: value.steps,
    nodes: nodes as ConnectionNode[],
    relationships: relationships as ConnectionRelationship[],
  };
}

export function parseDiscoveryResult(value: unknown): DiscoveryResult | null {
  if (!isRecord(value) || typeof value.found !== "boolean") return null;

  const bestPath = value.bestPath === null ? null : parsePath(value.bestPath);
  if (value.found && !bestPath) return null;

  const alternatePaths = Array.isArray(value.alternatePaths)
    ? value.alternatePaths
        .map(parsePath)
        .filter((path): path is ConnectionPathData => path !== null)
    : [];

  return { found: value.found, bestPath, alternatePaths };
}
