import type { NextRequest } from "next/server";
import { discoverConnection } from "@/lib/discover-connection";
import { Neo4jConfigurationError } from "@/lib/neo4j";
import {
  isValidQid,
  WikidataEntityNotFoundError,
  WikidataFetchError,
} from "@/lib/wikidata";

function toConsumerPath(path: {
  steps: number;
  nodes: unknown[];
  relationships: unknown[];
} | null) {
  return path
    ? {
        steps: path.steps,
        nodes: (path.nodes as Array<Record<string, unknown>>).map((node) => ({
          name: node.name,
          type: node.type,
          qid: node.qid,
        })),
        relationships: (
          path.relationships as Array<Record<string, unknown>>
        ).map((relationship) => ({
          label: relationship.label,
          from: relationship.from,
          to: relationship.to,
        })),
      }
    : null;
}

export async function GET(request: NextRequest) {
  const fromQid =
    request.nextUrl.searchParams.get("fromQid")?.trim().toUpperCase() ?? "";
  const toQid =
    request.nextUrl.searchParams.get("toQid")?.trim().toUpperCase() ?? "";

  if (!isValidQid(fromQid) || !isValidQid(toQid)) {
    return Response.json(
      { found: false, error: "Two valid Wikidata QIDs are required." },
      { status: 400 },
    );
  }

  try {
    const result = await discoverConnection(fromQid, toQid);
    const { discovery, ...consumerResult } = result;
    const debugEnabled =
      process.env.NODE_ENV === "development" &&
      request.nextUrl.searchParams.get("debug") === "1";

    if (debugEnabled) {
      return Response.json({ ...consumerResult, diagnostics: discovery });
    }

    return Response.json({
      found: consumerResult.found,
      source: consumerResult.source,
      target: consumerResult.target,
      bestPath: toConsumerPath(consumerResult.bestPath),
      alternatePaths: consumerResult.alternatePaths.map(toConsumerPath),
    });
  } catch (error: unknown) {
    if (error instanceof WikidataEntityNotFoundError) {
      return Response.json(
        { found: false, error: error.message },
        { status: 404 },
      );
    }

    if (error instanceof WikidataFetchError) {
      console.error("Connection discovery Wikidata fetch failed", error);
      return Response.json(
        { found: false, error: "Could not fetch a Wikidata entity." },
        { status: 502 },
      );
    }

    if (error instanceof Neo4jConfigurationError) {
      return Response.json(
        {
          found: false,
          error: "Neo4j is not configured.",
          missingVariables: error.missingVariables,
        },
        { status: 503 },
      );
    }

    console.error("Connection discovery failed", error);
    return Response.json(
      {
        found: false,
        error: "Could not discover a connection.",
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 503 },
    );
  }
}
