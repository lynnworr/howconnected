export type CuratedEntityInput = {
  qid: string;
  name: string;
  description: string;
  type: string;
};

export type CuratedRelationshipInput = {
  propertyId: string;
  relationshipType: string;
  label: string;
  reverseLabel: string;
  weight: number;
  traversable: boolean;
  statementId: string;
  statementRank: string;
  qualifiers: readonly {
    propertyId: string;
    value: string;
  }[];
};

export type CuratedTargetState = {
  totalNodes: number;
  totalRelationships: number;
  sourceExists: boolean;
  targetExists: boolean;
  relationships: readonly Record<string, unknown>[];
};

export type CuratedTargetPlan = {
  mode: "curated-target";
  source: CuratedEntityInput;
  target: CuratedEntityInput;
  relationship: CuratedRelationshipInput;
  before: {
    nodes: number;
    relationships: number;
  };
  after: {
    nodes: number;
    relationships: number;
  };
  changes: {
    nodesCreated: number;
    relationshipsCreated: number;
    existingNodesPreserved: number;
    existingRelationshipPreserved: boolean;
  };
  existingState: CuratedTargetState;
};

export type CuratedWriteResult = {
  plan: CuratedTargetPlan;
  nodesCreated: number;
  relationshipsCreated: number;
};

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function claimTargetQid(claim: unknown): string | null {
  if (!isJsonObject(claim) || claim.rank === "deprecated" || !isJsonObject(claim.mainsnak)) {
    return null;
  }
  const { mainsnak } = claim;
  if (
    mainsnak.snaktype !== "value" ||
    mainsnak.datatype !== "wikibase-item" ||
    !isJsonObject(mainsnak.datavalue) ||
    !isJsonObject(mainsnak.datavalue.value)
  ) {
    return null;
  }
  const id = mainsnak.datavalue.value.id;
  return typeof id === "string" && /^Q[1-9]\d*$/.test(id) ? id : null;
}

export function getNonDeprecatedClaimTargetQids(claims: readonly unknown[]): string[] {
  return [...new Set(claims.flatMap((claim) => {
    const qid = claimTargetQid(claim);
    return qid ? [qid] : [];
  }))];
}

function qualifierValue(snak: unknown): string | null {
  if (!isJsonObject(snak) || !isJsonObject(snak.datavalue)) return null;
  const value = snak.datavalue.value;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!isJsonObject(value)) return null;
  if (typeof value.time === "string") return value.time;
  if (typeof value.id === "string") return value.id;
  if (typeof value.amount === "string") return value.amount;
  return null;
}

export function selectVerifiedWikidataStatement(
  claims: readonly unknown[],
  targetQid: string,
): Pick<CuratedRelationshipInput, "statementId" | "statementRank" | "qualifiers"> {
  const claim = claims.find((candidate) => claimTargetQid(candidate) === targetQid);
  if (!isJsonObject(claim)) {
    throw new Error("Wikidata does not contain the requested curated-target statement.");
  }
  const qualifiers = isJsonObject(claim.qualifiers)
    ? Object.entries(claim.qualifiers).flatMap(([propertyId, snaks]) =>
        Array.isArray(snaks)
          ? snaks.flatMap((snak) => {
              const value = qualifierValue(snak);
              return value ? [{ propertyId, value }] : [];
            })
          : [],
      )
    : [];
  return {
    statementId: typeof claim.id === "string" ? claim.id : "unidentified-statement",
    statementRank: typeof claim.rank === "string" ? claim.rank : "normal",
    qualifiers,
  };
}

export type CuratedTargetWriter = {
  readTargetState(): Promise<CuratedTargetState>;
  createMissingNodes(
    source: CuratedEntityInput,
    target: CuratedEntityInput,
  ): Promise<number>;
  createMissingRelationship(
    sourceQid: string,
    targetQid: string,
    relationship: CuratedRelationshipInput,
  ): Promise<number>;
};

export type CuratedWriteExecutor = {
  executeWrite<T>(work: (writer: CuratedTargetWriter) => Promise<T>): Promise<T>;
};

export class CuratedTargetStateChangedError extends Error {
  constructor() {
    super("The curated-target database state changed after dry-run; generate a new plan before writing.");
    this.name = "CuratedTargetStateChangedError";
  }
}

function stableProperties(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  );
}

function relationshipProperties(input: CuratedRelationshipInput): Record<string, unknown> {
  return {
    label: input.label,
    reverseLabel: input.reverseLabel,
    traversable: input.traversable,
    weight: input.weight,
    wikidataProperty: input.propertyId,
  };
}

export function isExpectedCuratedRelationship(
  properties: Record<string, unknown>,
  expected: CuratedRelationshipInput,
): boolean {
  return stableProperties(properties) === stableProperties(relationshipProperties(expected));
}

export function createCuratedTargetPlan(input: {
  source: CuratedEntityInput;
  target: CuratedEntityInput;
  relationship: CuratedRelationshipInput;
  state: CuratedTargetState;
}): CuratedTargetPlan {
  if (input.source.qid === input.target.qid) {
    throw new Error("Curated-target ingestion requires two distinct entities.");
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(input.relationship.relationshipType)) {
    throw new Error("Curated-target ingestion received an invalid relationship type.");
  }
  if (input.state.relationships.length > 1) {
    throw new Error("Multiple matching relationship records require manual review.");
  }
  const existingRelationship = input.state.relationships[0];
  if (
    existingRelationship &&
    !isExpectedCuratedRelationship(existingRelationship, input.relationship)
  ) {
    throw new Error("An existing relationship has unexpected properties and will not be overwritten.");
  }

  const nodesCreated = Number(!input.state.sourceExists) + Number(!input.state.targetExists);
  const relationshipsCreated = Number(!existingRelationship);

  return {
    mode: "curated-target",
    source: input.source,
    target: input.target,
    relationship: input.relationship,
    before: {
      nodes: input.state.totalNodes,
      relationships: input.state.totalRelationships,
    },
    after: {
      nodes: input.state.totalNodes + nodesCreated,
      relationships: input.state.totalRelationships + relationshipsCreated,
    },
    changes: {
      nodesCreated,
      relationshipsCreated,
      existingNodesPreserved: 2 - nodesCreated,
      existingRelationshipPreserved: Boolean(existingRelationship),
    },
    existingState: input.state,
  };
}

function sameTargetState(
  left: CuratedTargetState,
  right: CuratedTargetState,
  relationship: CuratedRelationshipInput,
): boolean {
  if (
    left.totalNodes !== right.totalNodes ||
    left.totalRelationships !== right.totalRelationships ||
    left.sourceExists !== right.sourceExists ||
    left.targetExists !== right.targetExists ||
    left.relationships.length !== right.relationships.length
  ) {
    return false;
  }
  if (left.relationships.length === 0) return true;
  return (
    isExpectedCuratedRelationship(left.relationships[0], relationship) &&
    isExpectedCuratedRelationship(right.relationships[0], relationship)
  );
}

export async function executeCuratedTargetPlan(
  plan: CuratedTargetPlan,
  executor: CuratedWriteExecutor,
): Promise<CuratedWriteResult> {
  return executor.executeWrite(async (writer) => {
    const current = await writer.readTargetState();
    if (!sameTargetState(plan.existingState, current, plan.relationship)) {
      throw new CuratedTargetStateChangedError();
    }

    const nodesCreated = await writer.createMissingNodes(plan.source, plan.target);
    const relationshipsCreated = await writer.createMissingRelationship(
      plan.source.qid,
      plan.target.qid,
      plan.relationship,
    );

    if (
      nodesCreated !== plan.changes.nodesCreated ||
      relationshipsCreated !== plan.changes.relationshipsCreated
    ) {
      throw new CuratedTargetStateChangedError();
    }

    return { plan, nodesCreated, relationshipsCreated };
  });
}
