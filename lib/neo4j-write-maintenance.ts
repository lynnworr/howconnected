export type Neo4jWriteMode = "enabled" | "maintenance" | "invalid";

export const NEO4J_WRITE_MAINTENANCE_CODE = "neo4j_write_maintenance";

export class Neo4jWriteMaintenanceError extends Error {
  readonly mode: Exclude<Neo4jWriteMode, "enabled">;

  constructor(mode: Exclude<Neo4jWriteMode, "enabled">) {
    super("Neo4j writes are temporarily unavailable.");
    this.name = "Neo4jWriteMaintenanceError";
    this.mode = mode;
  }
}

export function getNeo4jWriteMode(
  value = process.env.NEO4J_WRITE_MODE,
): Neo4jWriteMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "enabled") return "enabled";
  if (normalized === "maintenance") return "maintenance";
  return "invalid";
}

export function assertNeo4jWritesAllowed(): void {
  const mode = getNeo4jWriteMode();
  if (mode !== "enabled") throw new Neo4jWriteMaintenanceError(mode);
}

export function neo4jWriteMaintenanceResponse(message: string): Response {
  return Response.json(
    {
      error: message,
      code: NEO4J_WRITE_MAINTENANCE_CODE,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "300",
      },
    },
  );
}
