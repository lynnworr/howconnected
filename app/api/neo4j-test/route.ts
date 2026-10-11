import { connection } from "next/server";
import {
  getNeo4jDriver,
  Neo4jConfigurationError,
} from "@/lib/neo4j";
import {
  allowNeo4jDiagnosticRoute,
  DIAGNOSTIC_NOINDEX_HEADERS,
} from "@/lib/diagnostic-route-policy";

export async function GET() {
  if (!allowNeo4jDiagnosticRoute(process.env.NODE_ENV)) {
    return Response.json(
      { error: "Not found." },
      { status: 404, headers: DIAGNOSTIC_NOINDEX_HEADERS },
    );
  }

  await connection();

  try {
    const result = await getNeo4jDriver().executeQuery("RETURN 1 AS ok");
    const ok = result.records[0]?.get("ok");

    return Response.json(
      {
        success: true,
        ok: ok?.toNumber() === 1,
      },
      { headers: DIAGNOSTIC_NOINDEX_HEADERS },
    );
  } catch (error: unknown) {
    if (error instanceof Neo4jConfigurationError) {
      return Response.json(
        {
          success: false,
          error: "Neo4j is not configured.",
          missingVariables: error.missingVariables,
        },
        { status: 503, headers: DIAGNOSTIC_NOINDEX_HEADERS },
      );
    }

    console.error("Neo4j connection test failed", error);

    return Response.json(
      {
        success: false,
        error: "Could not connect to Neo4j.",
      },
      { status: 503, headers: DIAGNOSTIC_NOINDEX_HEADERS },
    );
  }
}
