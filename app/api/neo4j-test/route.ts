import { connection } from "next/server";
import {
  getNeo4jDriver,
  Neo4jConfigurationError,
} from "@/lib/neo4j";

export async function GET() {
  await connection();

  try {
    const result = await getNeo4jDriver().executeQuery("RETURN 1 AS ok");
    const ok = result.records[0]?.get("ok");

    return Response.json({
      success: true,
      ok: ok?.toNumber() === 1,
    });
  } catch (error: unknown) {
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

    console.error("Neo4j connection test failed", error);

    return Response.json(
      {
        success: false,
        error: "Could not connect to Neo4j.",
      },
      { status: 503 },
    );
  }
}
