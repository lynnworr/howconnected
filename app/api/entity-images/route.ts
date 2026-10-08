import type { NextRequest } from "next/server";
import { resolveEntityEnrichment } from "@/lib/entity-images";
import { isValidQid } from "@/lib/wikidata-id";

const MAX_QIDS = 12;

export async function GET(request: NextRequest) {
  const rawQids = request.nextUrl.searchParams.get("qids") ?? "";
  const qids = [
    ...new Set(
      rawQids
        .split(",")
        .map((qid) => qid.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  if (qids.length === 0 || qids.length > MAX_QIDS || qids.some((qid) => !isValidQid(qid))) {
    return Response.json(
      { error: `Provide between 1 and ${MAX_QIDS} valid Wikidata QIDs.` },
      { status: 400 },
    );
  }

  try {
    return Response.json(await resolveEntityEnrichment(qids));
  } catch (error: unknown) {
    console.error("Entity enrichment failed", error);
    return Response.json(
      { error: "Entity enrichment is temporarily unavailable." },
      { status: 502 },
    );
  }
}
