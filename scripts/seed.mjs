import neo4j from "neo4j-driver";

const requiredEnvironmentVariables = [
  "NEO4J_URI",
  "NEO4J_USERNAME",
  "NEO4J_PASSWORD",
];

const missingVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    `Missing required Neo4j environment variables: ${missingVariables.join(", ")}`,
  );
  process.exitCode = 1;
} else {
  const entities = [
    { name: "Steve Jobs", type: "person", qid: "Q19837" },
    { name: "Pixar", type: "company", qid: "Q127552" },
    {
      name: "The Walt Disney Company",
      type: "company",
      qid: "Q7414",
    },
    { name: "Walt Disney", type: "person", qid: "Q8704" },
    { name: "Apple", type: "company", qid: "Q312" },
    { name: "George Lucas", type: "person", qid: "Q38222" },
    { name: "Lucasfilm", type: "company", qid: "Q242446" },
    { name: "Star Wars", type: "franchise", qid: "Q462" },
    { name: "Tim Cook", type: "person", qid: "Q265852" },
    { name: "Bob Iger", type: "person", qid: "Q532423" },
  ];

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME,
      process.env.NEO4J_PASSWORD,
    ),
  );

  try {
    await driver.executeQuery(`
      CREATE CONSTRAINT entity_qid_unique IF NOT EXISTS
      FOR (entity:Entity)
      REQUIRE entity.qid IS UNIQUE
    `);

    await driver.executeQuery(
      `
        UNWIND $entities AS entity
        MERGE (node:Entity {qid: entity.qid})
        SET node.name = entity.name,
            node.type = entity.type
      `,
      { entities },
    );

    await driver.executeQuery(`
      MATCH (steve:Entity {qid: "Q19837"})
      MATCH (pixar:Entity {qid: "Q127552"})
      MATCH (disney:Entity {qid: "Q7414"})
      MATCH (walt:Entity {qid: "Q8704"})
      MATCH (apple:Entity {qid: "Q312"})
      MATCH (george:Entity {qid: "Q38222"})
      MATCH (lucasfilm:Entity {qid: "Q242446"})
      MATCH (starWars:Entity {qid: "Q462"})
      MATCH (tim:Entity {qid: "Q265852"})
      MATCH (bob:Entity {qid: "Q532423"})
      MERGE (steve)-[:CO_FOUNDED]->(pixar)
      MERGE (steve)-[:CO_FOUNDED]->(apple)
      MERGE (pixar)-[:ACQUIRED_BY]->(disney)
      MERGE (walt)-[:CO_FOUNDED]->(disney)
      MERGE (george)-[:FOUNDED]->(lucasfilm)
      MERGE (lucasfilm)-[:ACQUIRED_BY]->(disney)
      MERGE (lucasfilm)-[:CREATED]->(starWars)
      MERGE (tim)-[:CEO_OF]->(apple)
      MERGE (bob)-[:CEO_OF]->(disney)
    `);

    const counts = await driver.executeQuery(`
      MATCH (node)
      WITH count(node) AS nodeCount
      MATCH ()-[relationship]->()
      RETURN nodeCount, count(relationship) AS relationshipCount
    `);

    const record = counts.records[0];

    console.log(
      JSON.stringify({
        success: true,
        nodes: record.get("nodeCount").toNumber(),
        relationships: record.get("relationshipCount").toNumber(),
      }),
    );
  } catch (error) {
    console.error("Failed to seed Neo4j:", error);
    process.exitCode = 1;
  } finally {
    await driver.close();
  }
}
