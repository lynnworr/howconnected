import type { NextRequest } from "next/server";
import { ingestWikidataEntity } from "@/lib/ingest-wikidata";
import { Neo4jConfigurationError } from "@/lib/neo4j";
import {
  isValidQid,
  WikidataEntityNotFoundError,
  WikidataFetchError,
} from "@/lib/wikidata";

export async function GET(request: NextRequest) {
  const qid = request.nextUrl.searchParams.get("qid")?.trim().toUpperCase() ?? "";

  if (!isValidQid(qid)) {
    return Response.json(
      { success: false, error: "A valid Wikidata QID is required." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestWikidataEntity(qid);
    return Response.json({ success: true, ...result });
  } catch (error: unknown) {
    if (error instanceof WikidataEntityNotFoundError) {
      return Response.json(
        { success: false, error: error.message },
        { status: 404 },
      );
    }

    if (error instanceof WikidataFetchError) {
      console.error("Wikidata ingestion fetch failed", error);
      return Response.json(
        { success: false, error: "Could not fetch the Wikidata entity." },
        { status: 502 },
      );
    }

    if (error instanceof Neo4jConfigurationError) {
      return Response.json(
        {
          success: false,
          error: "Neo4j is not configured.",
          missingVariables: error.missingVariables,
        },
        { status: 503 },
      );
    }

    console.error("Wikidata ingestion failed", error);
    return Response.json(
      { success: false, error: "Could not ingest the Wikidata entity." },
      { status: 503 },
    );
  }
}
