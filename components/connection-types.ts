export type SelectedEntity = {
  id: string;
  label: string;
  description: string;
};

export type ConnectionNode = {
  name: string;
  type: string;
  qid: string | null;
  imageUrl?: string;
  imageAlt?: string;
  wikipediaUrl?: string;
  wikidataUrl?: string;
  sourceLabel?: "Wikipedia" | "Wikidata";
};

export type ConnectionRelationship = {
  label: string;
  from: string;
  to: string;
  propertyId?: string;
  propertyUrl?: string;
  statementDirection?: "forward" | "reverse";
  qualifiers?: ConnectionQualifier[];
};

export type ConnectionQualifier = {
  propertyId: string;
  label: string;
  value: string;
  sourceUrl?: string;
};

export type ConnectionPathData = {
  steps: number;
  nodes: ConnectionNode[];
  relationships: ConnectionRelationship[];
};

export type DiscoveryResult = {
  found: boolean;
  timedOut: boolean;
  failureCategory?: import("@/lib/discovery-failure-category").DiscoveryFailureCategory;
  bestPath: ConnectionPathData | null;
  alternatePaths: ConnectionPathData[];
};
