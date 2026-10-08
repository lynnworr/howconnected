import "server-only";

import neo4j, { type Driver } from "neo4j-driver";

const NEO4J_ENVIRONMENT_VARIABLES = [
  "NEO4J_URI",
  "NEO4J_USERNAME",
  "NEO4J_PASSWORD",
] as const;

type Neo4jEnvironmentVariable =
  (typeof NEO4J_ENVIRONMENT_VARIABLES)[number];

export class Neo4jConfigurationError extends Error {
  constructor(public readonly missingVariables: Neo4jEnvironmentVariable[]) {
    super(
      `Missing required Neo4j environment variables: ${missingVariables.join(", ")}`,
    );
    this.name = "Neo4jConfigurationError";
  }
}

let driver: Driver | undefined;

export function getNeo4jDriver(): Driver {
  if (driver) {
    return driver;
  }

  const missingVariables = NEO4J_ENVIRONMENT_VARIABLES.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Neo4jConfigurationError(missingVariables);
  }

  const uri = process.env.NEO4J_URI as string;
  const username = process.env.NEO4J_USERNAME as string;
  const password = process.env.NEO4J_PASSWORD as string;

  driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

  return driver;
}
