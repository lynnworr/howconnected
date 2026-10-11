import type {
  ConnectionNode,
  ConnectionPathData,
  ConnectionQualifier,
  ConnectionRelationship,
  DiscoveryResult,
  SelectedEntity,
} from "../components/connection-types.ts";
import { isValidQid } from "./wikidata-id.ts";

export const EDITORIAL_SNAPSHOT_MAX_AGE_DAYS = 365;

export type EditorialReviewStatus = "approved" | "needs-review" | "rejected";
export type StatementDirection = "forward" | "reverse";

export type ExpectedEditorialRelationship = {
  propertyId: string;
  subjectQid: string;
  objectQid: string;
  pathDirection: StatementDirection;
  qualifierPropertyIds?: readonly string[];
};

export type EditorialSnapshot = {
  version: 1;
  source: SelectedEntity;
  target: SelectedEntity;
  path: ConnectionPathData;
  editorialExplanation: string;
};

export type EditorialConnection = {
  slug: string;
  canonicalFromQid: string;
  canonicalToQid: string;
  pathFingerprint: string;
  expectedRelationships: readonly ExpectedEditorialRelationship[];
  reviewStatus: EditorialReviewStatus;
  verifiedAt: string;
  indexEligible: boolean;
  snapshot: EditorialSnapshot | null;
  reviewNotes?: string;
};

export type SnapshotValidation =
  | { status: "ready"; connection: EditorialConnection; snapshot: EditorialSnapshot }
  | { status: "missing"; connection: EditorialConnection }
  | { status: "invalid"; connection: EditorialConnection; errors: string[] }
  | { status: "stale"; connection: EditorialConnection; staleSince: string };

function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`;
}

function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function node(
  qid: string,
  name: string,
  type: string,
  wikipediaTitle?: string,
): ConnectionNode {
  return {
    qid,
    name,
    type,
    wikidataUrl: wikidataUrl(qid),
    wikipediaUrl: wikipediaTitle ? wikipediaUrl(wikipediaTitle) : undefined,
    sourceLabel: wikipediaTitle ? "Wikipedia" : "Wikidata",
  };
}

function qualifier(
  propertyId: string,
  label: string,
  value: string,
): ConnectionQualifier {
  return {
    propertyId,
    label,
    value,
    sourceUrl: `https://www.wikidata.org/wiki/Property:${propertyId}`,
  };
}

function relationship(
  label: string,
  from: string,
  to: string,
  propertyId: string,
  statementDirection: StatementDirection,
  qualifiers: ConnectionQualifier[] = [],
): ConnectionRelationship {
  return {
    label,
    from,
    to,
    propertyId,
    propertyUrl: `https://www.wikidata.org/wiki/Property:${propertyId}`,
    statementDirection,
    qualifiers,
  };
}

function directSnapshot(input: {
  source: SelectedEntity;
  target: SelectedEntity;
  sourceNode: ConnectionNode;
  targetNode: ConnectionNode;
  relationship: ConnectionRelationship;
  editorialExplanation: string;
}): EditorialSnapshot {
  return {
    version: 1,
    source: input.source,
    target: input.target,
    path: {
      steps: 1,
      nodes: [input.sourceNode, input.targetNode],
      relationships: [input.relationship],
    },
    editorialExplanation: input.editorialExplanation,
  };
}

function entity(id: string, label: string, description: string): SelectedEntity {
  return { id, label, description };
}

export const EDITORIAL_CONNECTIONS: readonly EditorialConnection[] = [
  {
    slug: "steve-jobs-apple",
    canonicalFromQid: "Q19837",
    canonicalToQid: "Q312",
    pathFingerprint: "hc-v1-553e20db",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q312",
        objectQid: "Q19837",
        pathDirection: "reverse",
        qualifierPropertyIds: ["P580"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: true,
    snapshot: directSnapshot({
      source: entity("Q19837", "Steve Jobs", "American entrepreneur and co-founder of Apple"),
      target: entity("Q312", "Apple Inc.", "American multinational technology company"),
      sourceNode: node("Q19837", "Steve Jobs", "person", "Steve Jobs"),
      targetNode: node("Q312", "Apple Inc.", "company/organization", "Apple Inc."),
      relationship: relationship(
        "co-founded",
        "Steve Jobs",
        "Apple Inc.",
        "P112",
        "reverse",
        [qualifier("P580", "start date", "1 April 1976")],
      ),
      editorialExplanation:
        "Apple Inc. identifies Steve Jobs as one of its founders, with the founding relationship dated 1 April 1976. The path is shown from Jobs to Apple, so it reads in the reverse direction of Wikidata property P112 (founded by).",
    }),
  },
  {
    slug: "walt-disney-the-walt-disney-company",
    canonicalFromQid: "Q8704",
    canonicalToQid: "Q7414",
    pathFingerprint: "hc-v1-c8b4a8da",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q7414",
        objectQid: "Q8704",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: true,
    snapshot: directSnapshot({
      source: entity("Q8704", "Walt Disney", "American animator, producer, and entrepreneur"),
      target: entity("Q7414", "The Walt Disney Company", "American multinational mass media company"),
      sourceNode: node("Q8704", "Walt Disney", "person", "Walt Disney"),
      targetNode: node("Q7414", "The Walt Disney Company", "company/organization", "The Walt Disney Company"),
      relationship: relationship(
        "co-founded",
        "Walt Disney",
        "The Walt Disney Company",
        "P112",
        "reverse",
      ),
      editorialExplanation:
        "The Walt Disney Company identifies Walt Disney as a founder. The displayed route runs from Walt Disney to the company, which is the reverse reading of Wikidata property P112 (founded by).",
    }),
  },
  {
    slug: "george-lucas-lucasfilm",
    canonicalFromQid: "Q38222",
    canonicalToQid: "Q242446",
    pathFingerprint: "hc-v1-b60a3367",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q242446",
        objectQid: "Q38222",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "The direct P112 claim is plausible but currently lacks a Wikidata reference. Obtain editorial source confirmation before indexing.",
    snapshot: directSnapshot({
      source: entity("Q38222", "George Lucas", "American filmmaker and philanthropist"),
      target: entity("Q242446", "Lucasfilm", "American film and television production company"),
      sourceNode: node("Q38222", "George Lucas", "person", "George Lucas"),
      targetNode: node("Q242446", "Lucasfilm", "company/organization", "Lucasfilm"),
      relationship: relationship(
        "founded",
        "George Lucas",
        "Lucasfilm",
        "P112",
        "reverse",
      ),
      editorialExplanation:
        "Lucasfilm identifies George Lucas as its founder. The route is displayed from Lucas to Lucasfilm, reversing Wikidata property P112 (founded by) into its natural-language inverse, founded.",
    }),
  },
  {
    slug: "nasa-dwight-eisenhower",
    canonicalFromQid: "Q23548",
    canonicalToQid: "Q9916",
    pathFingerprint: "hc-v1-8b265cba",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q23548",
        objectQid: "Q9916",
        pathDirection: "forward",
        qualifierPropertyIds: ["P585", "P3831"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: true,
    snapshot: directSnapshot({
      source: entity("Q23548", "National Aeronautics and Space Administration", "American space and aeronautics agency"),
      target: entity("Q9916", "Dwight D. Eisenhower", "34th president of the United States"),
      sourceNode: node("Q23548", "National Aeronautics and Space Administration", "government/scientific organization", "NASA"),
      targetNode: node("Q9916", "Dwight D. Eisenhower", "person", "Dwight D. Eisenhower"),
      relationship: relationship(
        "founded by",
        "National Aeronautics and Space Administration",
        "Dwight D. Eisenhower",
        "P112",
        "forward",
        [
          qualifier("P585", "point in time", "29 July 1958"),
          qualifier("P3831", "object has role", "President of the United States"),
        ],
      ),
      editorialExplanation:
        "NASA identifies Dwight D. Eisenhower as a founder in his role as President of the United States, with the statement dated 29 July 1958, when he signed the National Aeronautics and Space Act.",
    }),
  },
  {
    slug: "heroes-iii-android",
    canonicalFromQid: "Q220965",
    canonicalToQid: "Q94",
    pathFingerprint: "hc-v1-8e3cd2b9",
    expectedRelationships: [
      {
        propertyId: "P400",
        subjectQid: "Q220965",
        objectQid: "Q94",
        pathDirection: "forward",
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "Confirm the Android release context and an external source before indexing; the Wikidata P400 statement is currently unreferenced.",
    snapshot: directSnapshot({
      source: entity("Q220965", "Heroes of Might and Magic III: The Restoration of Erathia", "1999 strategy video game"),
      target: entity("Q94", "Android", "Mobile operating system"),
      sourceNode: node("Q220965", "Heroes of Might and Magic III: The Restoration of Erathia", "creative work", "Heroes of Might and Magic III"),
      targetNode: node("Q94", "Android", "product", "Android (operating system)"),
      relationship: relationship(
        "platform",
        "Heroes of Might and Magic III: The Restoration of Erathia",
        "Android",
        "P400",
        "forward",
      ),
      editorialExplanation:
        "Wikidata lists Android among the platforms for Heroes of Might and Magic III: The Restoration of Erathia. This describes platform availability, not the platform of the game's original 1999 release.",
    }),
  },
  {
    slug: "freebase-data-dumps-google",
    canonicalFromQid: "Q15241312",
    canonicalToQid: "Q95",
    pathFingerprint: "hc-v1-7db1704e",
    expectedRelationships: [
      {
        propertyId: "P123",
        subjectQid: "Q15241312",
        objectQid: "Q95",
        pathDirection: "forward",
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "Confirm the publication relationship with an external source before indexing; the Wikidata P123 statement is currently unreferenced.",
    snapshot: directSnapshot({
      source: entity("Q15241312", "Freebase Data Dumps", "Dumps of the public part of Google's Knowledge Graph"),
      target: entity("Q95", "Google", "American multinational technology company"),
      sourceNode: node("Q15241312", "Freebase Data Dumps", "creative work"),
      targetNode: node("Q95", "Google", "company/organization", "Google"),
      relationship: relationship(
        "publisher",
        "Freebase Data Dumps",
        "Google",
        "P123",
        "forward",
      ),
      editorialExplanation:
        "Wikidata identifies Google as the publisher of the Freebase Data Dumps. This is a publication relationship between the released dataset and the organization that published it.",
    }),
  },
  {
    slug: "statue-of-liberty-france-historical-location",
    canonicalFromQid: "Q9202",
    canonicalToQid: "Q142",
    pathFingerprint: "hc-v1-a50bd101",
    expectedRelationships: [
      {
        propertyId: "P276",
        subjectQid: "Q9202",
        objectQid: "Q142",
        pathDirection: "forward",
        qualifierPropertyIds: ["P582"],
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "Historically accurate only when the end-time qualifier is visible. Keep out of the index until editorial review confirms the wording and evidence.",
    snapshot: directSnapshot({
      source: entity("Q9202", "Statue of Liberty", "Monument in New York"),
      target: entity("Q142", "France", "Country in Western Europe and other continents"),
      sourceNode: node("Q9202", "Statue of Liberty", "monument/artifact", "Statue of Liberty"),
      targetNode: node("Q142", "France", "place", "France"),
      relationship: relationship(
        "historical location",
        "Statue of Liberty",
        "France",
        "P276",
        "forward",
        [qualifier("P582", "end time", "June 1885")],
      ),
      editorialExplanation:
        "Wikidata records France as a historical location of the Statue of Liberty only until June 1885, before the monument was shipped to the United States. France is not presented here as the monument's current location.",
    }),
  },
] as const;

function normalizeQid(value: string): string {
  return value.trim().toUpperCase();
}

function pairKey(fromQid: string, toQid: string): string {
  return `${normalizeQid(fromQid)}:${normalizeQid(toQid)}`;
}

const CONNECTIONS_BY_CANONICAL_PAIR = new Map(
  EDITORIAL_CONNECTIONS.map((connection) => [
    pairKey(connection.canonicalFromQid, connection.canonicalToQid),
    connection,
  ]),
);

const CONNECTIONS_BY_REVERSED_PAIR = new Map(
  EDITORIAL_CONNECTIONS.map((connection) => [
    pairKey(connection.canonicalToQid, connection.canonicalFromQid),
    connection,
  ]),
);

function safeUrl(value: string | undefined, hostname: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === hostname;
  } catch {
    return false;
  }
}

function fingerprintInput(snapshot: EditorialSnapshot): string {
  return JSON.stringify({
    version: snapshot.version,
    source: snapshot.source.id,
    target: snapshot.target.id,
    nodes: snapshot.path.nodes.map((item) => item.qid),
    relationships: snapshot.path.relationships.map((item) => ({
      propertyId: item.propertyId,
      from: item.from,
      to: item.to,
      statementDirection: item.statementDirection,
      qualifiers: item.qualifiers?.map((item) => ({
        propertyId: item.propertyId,
        value: item.value,
      })) ?? [],
    })),
  });
}

export function createEditorialPathFingerprint(snapshot: EditorialSnapshot): string {
  let hash = 2166136261;
  for (const character of fingerprintInput(snapshot)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `hc-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function findEditorialConnection(
  fromQid: string,
  toQid: string,
): EditorialConnection | null {
  return CONNECTIONS_BY_CANONICAL_PAIR.get(pairKey(fromQid, toQid)) ?? null;
}

export function findReversedEditorialConnection(
  fromQid: string,
  toQid: string,
): EditorialConnection | null {
  return CONNECTIONS_BY_REVERSED_PAIR.get(pairKey(fromQid, toQid)) ?? null;
}

export function validateEditorialSnapshot(
  connection: EditorialConnection,
  now = new Date(),
): SnapshotValidation {
  const snapshot = connection.snapshot;
  if (!snapshot) return { status: "missing", connection };

  const errors: string[] = [];
  if (snapshot.source.id !== connection.canonicalFromQid) {
    errors.push("Snapshot source does not match the canonical source QID.");
  }
  if (snapshot.target.id !== connection.canonicalToQid) {
    errors.push("Snapshot target does not match the canonical target QID.");
  }
  if (snapshot.path.steps !== snapshot.path.relationships.length) {
    errors.push("Snapshot step count does not match its relationship count.");
  }
  if (snapshot.path.nodes.length !== snapshot.path.relationships.length + 1) {
    errors.push("Snapshot node and relationship counts do not form a path.");
  }
  if (
    snapshot.path.nodes.some(
      (item) => !item.qid || !isValidQid(item.qid) || !safeUrl(item.wikidataUrl, "www.wikidata.org"),
    )
  ) {
    errors.push("Every snapshot node must have a valid QID and Wikidata evidence URL.");
  }
  if (
    snapshot.path.nodes.some(
      (item) => item.wikipediaUrl && !safeUrl(item.wikipediaUrl, "en.wikipedia.org"),
    )
  ) {
    errors.push("Snapshot Wikipedia evidence URLs must use English Wikipedia over HTTPS.");
  }
  if (snapshot.path.relationships.length !== connection.expectedRelationships.length) {
    errors.push("Snapshot relationships do not match the expected relationship count.");
  }

  connection.expectedRelationships.forEach((expected, index) => {
    const actual = snapshot.path.relationships[index];
    if (!actual) return;
    if (actual.propertyId !== expected.propertyId) {
      errors.push(`Relationship ${index + 1} has an unexpected property ID.`);
    }
    if (actual.statementDirection !== expected.pathDirection) {
      errors.push(`Relationship ${index + 1} has an unexpected statement direction.`);
    }
    if (!safeUrl(actual.propertyUrl, "www.wikidata.org")) {
      errors.push(`Relationship ${index + 1} is missing a Wikidata property URL.`);
    }
    const actualFrom = snapshot.path.nodes[index]?.qid;
    const actualTo = snapshot.path.nodes[index + 1]?.qid;
    const statementSubject = expected.pathDirection === "forward" ? actualFrom : actualTo;
    const statementObject = expected.pathDirection === "forward" ? actualTo : actualFrom;
    if (statementSubject !== expected.subjectQid || statementObject !== expected.objectQid) {
      errors.push(`Relationship ${index + 1} has unexpected statement endpoints.`);
    }
    const actualQualifierIds = new Set(
      actual.qualifiers?.map((item) => item.propertyId) ?? [],
    );
    for (const propertyId of expected.qualifierPropertyIds ?? []) {
      if (!actualQualifierIds.has(propertyId)) {
        errors.push(`Relationship ${index + 1} is missing qualifier ${propertyId}.`);
      }
    }
    if (
      actual.qualifiers?.some(
        (item) =>
          !/^P[1-9]\d*$/.test(item.propertyId) ||
          !item.label.trim() ||
          !item.value.trim() ||
          !safeUrl(item.sourceUrl, "www.wikidata.org"),
      )
    ) {
      errors.push(`Relationship ${index + 1} has an invalid qualifier.`);
    }
  });

  if (createEditorialPathFingerprint(snapshot) !== connection.pathFingerprint) {
    errors.push("Snapshot fingerprint does not match the reviewed fingerprint.");
  }
  if (!snapshot.editorialExplanation.trim()) {
    errors.push("Snapshot is missing an editorial explanation.");
  }

  const verifiedAt = new Date(connection.verifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) {
    errors.push("Verification timestamp is invalid.");
  }
  if (errors.length > 0) return { status: "invalid", connection, errors };

  const staleAt = new Date(
    verifiedAt.getTime() + EDITORIAL_SNAPSHOT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  if (now.getTime() > staleAt.getTime()) {
    return { status: "stale", connection, staleSince: staleAt.toISOString() };
  }

  return { status: "ready", connection, snapshot };
}

export function getIndexableEditorialConnections(
  now = new Date(),
): EditorialConnection[] {
  return EDITORIAL_CONNECTIONS.filter(
    (connection) =>
      connection.indexEligible &&
      connection.reviewStatus === "approved" &&
      validateEditorialSnapshot(connection, now).status === "ready",
  );
}

export function snapshotToDiscoveryResult(snapshot: EditorialSnapshot): DiscoveryResult {
  return {
    found: true,
    timedOut: false,
    bestPath: snapshot.path,
    alternatePaths: [],
  };
}
