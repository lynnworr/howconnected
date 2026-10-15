import {
  findEditorialConnectionBySlug,
  getIndexableEditorialConnections,
  validateEditorialSnapshot,
  type EditorialConnection,
  type EditorialSnapshot,
} from "./editorial-connections.ts";

export type EmbeddableConnection = {
  connection: EditorialConnection;
  snapshot: EditorialSnapshot;
};

export function getEmbeddableConnections(now = new Date()): EmbeddableConnection[] {
  return getIndexableEditorialConnections(now).flatMap((connection) => {
    const validation = validateEditorialSnapshot(connection, now);
    return validation.status === "ready"
      ? [{ connection, snapshot: validation.snapshot }]
      : [];
  });
}

export function getEmbeddableConnection(
  slug: string,
  now = new Date(),
): EmbeddableConnection | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const connection = findEditorialConnectionBySlug(slug);
  if (!connection || !connection.indexEligible || connection.reviewStatus !== "approved") {
    return null;
  }
  const validation = validateEditorialSnapshot(connection, now);
  return validation.status === "ready"
    ? { connection, snapshot: validation.snapshot }
    : null;
}
