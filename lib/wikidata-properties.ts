export type RelationshipConfig = {
  label: string;
  reverseLabel: string;
  weight: number;
  traversable: boolean;
  maxFanout?: number;
  reverseDiscoveryEnabled?: boolean;
  reverseDiscoveryLabel?: string;
  reverseDiscoveryFanout?: number;
  domainWeights?: Readonly<Record<string, number>>;
};

export type WikidataPropertyConfig = RelationshipConfig & {
  wikidataProperty: string;
  relationship: string;
};

type WikidataPropertyBase = Pick<
  WikidataPropertyConfig,
  "wikidataProperty" | "relationship" | "label" | "weight"
>;

export const MAX_LINKED_ENTITIES_PER_PROPERTY = 5;
export const MAX_RELATIONSHIPS_PER_INGESTION = 30;
export const WIKIDATA_EXPANSION_VERSION = 4;

const BASE_WIKIDATA_PROPERTIES = {
  P26: { wikidataProperty: "P26", label: "spouse", relationship: "SPOUSE", weight: 1.0 },
  P40: { wikidataProperty: "P40", label: "child", relationship: "CHILD", weight: 1.0 },
  P22: { wikidataProperty: "P22", label: "father", relationship: "FATHER", weight: 1.0 },
  P25: { wikidataProperty: "P25", label: "mother", relationship: "MOTHER", weight: 1.0 },
  P27: { wikidataProperty: "P27", label: "country of citizenship", relationship: "COUNTRY_OF_CITIZENSHIP", weight: 1.15 },
  P69: { wikidataProperty: "P69", label: "educated at", relationship: "EDUCATED_AT", weight: 1.2 },
  P108: { wikidataProperty: "P108", label: "employer", relationship: "EMPLOYER", weight: 1.2 },
  P463: { wikidataProperty: "P463", label: "member of", relationship: "MEMBER_OF", weight: 1.1 },
  P112: { wikidataProperty: "P112", label: "founded by", relationship: "FOUNDED_BY", weight: 1.0 },
  P127: { wikidataProperty: "P127", label: "owned by", relationship: "OWNED_BY", weight: 1.1 },
  P749: { wikidataProperty: "P749", label: "parent organization", relationship: "PARENT_ORGANIZATION", weight: 1.1 },
  P355: { wikidataProperty: "P355", label: "subsidiary", relationship: "SUBSIDIARY", weight: 1.1 },
  P159: { wikidataProperty: "P159", label: "headquarters location", relationship: "HEADQUARTERS_LOCATION", weight: 1.3 },
  P17: { wikidataProperty: "P17", label: "country", relationship: "COUNTRY", weight: 1.3 },
  P84: { wikidataProperty: "P84", label: "architect", relationship: "ARCHITECT", weight: 1.0 },
  P88: { wikidataProperty: "P88", label: "commissioned by", relationship: "COMMISSIONED_BY", weight: 1.1 },
  P131: { wikidataProperty: "P131", label: "located in administrative territorial entity", relationship: "LOCATED_IN_ADMINISTRATIVE_ENTITY", weight: 1.5 },
  P276: { wikidataProperty: "P276", label: "location", relationship: "LOCATION", weight: 1.2 },
  P361: { wikidataProperty: "P361", label: "part of", relationship: "PART_OF", weight: 1.6 },
  P495: { wikidataProperty: "P495", label: "country of origin", relationship: "COUNTRY_OF_ORIGIN", weight: 1.0 },
  P793: { wikidataProperty: "P793", label: "significant event", relationship: "SIGNIFICANT_EVENT", weight: 2.0 },
  P1365: { wikidataProperty: "P1365", label: "replaces", relationship: "REPLACES", weight: 1.1 },
  P1366: { wikidataProperty: "P1366", label: "replaced by", relationship: "REPLACED_BY", weight: 1.1 },
  P272: { wikidataProperty: "P272", label: "production company", relationship: "PRODUCTION_COMPANY", weight: 1.2 },
  P750: { wikidataProperty: "P750", label: "distributed by", relationship: "DISTRIBUTED_BY", weight: 1.4 },
  P449: { wikidataProperty: "P449", label: "original broadcaster", relationship: "ORIGINAL_BROADCASTER", weight: 1.3 },
  P170: { wikidataProperty: "P170", label: "creator", relationship: "CREATOR", weight: 1.0 },
  P161: { wikidataProperty: "P161", label: "cast member", relationship: "CAST_MEMBER", weight: 1.2 },
  P725: { wikidataProperty: "P725", label: "voice actor", relationship: "VOICE_ACTOR", weight: 1.2 },
  P57: { wikidataProperty: "P57", label: "director", relationship: "DIRECTOR", weight: 1.0 },
  P58: { wikidataProperty: "P58", label: "screenwriter", relationship: "SCREENWRITER", weight: 1.1 },
  P50: { wikidataProperty: "P50", label: "author", relationship: "AUTHOR", weight: 1.0 },
  P86: { wikidataProperty: "P86", label: "composer", relationship: "COMPOSER", weight: 1.1 },
  P1431: { wikidataProperty: "P1431", label: "executive producer", relationship: "EXECUTIVE_PRODUCER", weight: 1.2 },
  P162: { wikidataProperty: "P162", label: "producer", relationship: "PRODUCER", weight: 1.1 },
  P175: { wikidataProperty: "P175", label: "performer", relationship: "PERFORMER", weight: 1.0 },
  P264: { wikidataProperty: "P264", label: "record label", relationship: "RECORD_LABEL", weight: 1.2 },
  P767: { wikidataProperty: "P767", label: "contributor", relationship: "CONTRIBUTOR", weight: 1.2 },
  P155: { wikidataProperty: "P155", label: "follows", relationship: "FOLLOWS", weight: 1.8 },
  P156: { wikidataProperty: "P156", label: "followed by", relationship: "FOLLOWED_BY", weight: 1.8 },
  P176: { wikidataProperty: "P176", label: "manufacturer", relationship: "MANUFACTURER", weight: 1.2 },
  P178: { wikidataProperty: "P178", label: "developer", relationship: "DEVELOPER", weight: 1.0 },
  P1441: { wikidataProperty: "P1441", label: "present in work", relationship: "PRESENT_IN_WORK", weight: 1.4 },
  P800: { wikidataProperty: "P800", label: "notable work", relationship: "NOTABLE_WORK", weight: 1.2 },
  P54: { wikidataProperty: "P54", label: "member of sports team", relationship: "MEMBER_OF_SPORTS_TEAM", weight: 1.1 },
  P118: { wikidataProperty: "P118", label: "league", relationship: "LEAGUE", weight: 1.1 },
  P286: { wikidataProperty: "P286", label: "head coach", relationship: "HEAD_COACH", weight: 1.0 },
  P115: { wikidataProperty: "P115", label: "home venue", relationship: "HOME_VENUE", weight: 1.2 },
  P859: { wikidataProperty: "P859", label: "sponsor", relationship: "SPONSOR", weight: 1.4 },
  P664: { wikidataProperty: "P664", label: "organizer", relationship: "ORGANIZER", weight: 1.1 },
  P710: { wikidataProperty: "P710", label: "participant", relationship: "PARTICIPANT", weight: 1.2 },
  P1344: { wikidataProperty: "P1344", label: "participant in", relationship: "PARTICIPANT_IN", weight: 1.2 },
  P137: { wikidataProperty: "P137", label: "operator", relationship: "OPERATOR", weight: 1.1 },
  P113: { wikidataProperty: "P113", label: "airline hub", relationship: "AIRLINE_HUB", weight: 1.2 },
  P607: { wikidataProperty: "P607", label: "conflict", relationship: "CONFLICT", weight: 1.1 },
  P169: { wikidataProperty: "P169", label: "chief executive officer", relationship: "CHIEF_EXECUTIVE_OFFICER", weight: 1.0 },
  P1056: { wikidataProperty: "P1056", label: "product or material produced", relationship: "PRODUCES", weight: 1.2 },
  P102: { wikidataProperty: "P102", label: "member of political party", relationship: "MEMBER_OF_POLITICAL_PARTY", weight: 1.1 },
  P166: { wikidataProperty: "P166", label: "award received", relationship: "AWARD_RECEIVED", weight: 1.5 },
  P737: { wikidataProperty: "P737", label: "influenced by", relationship: "INFLUENCED_BY", weight: 1.3 },
  P138: { wikidataProperty: "P138", label: "named after", relationship: "NAMED_AFTER", weight: 1.3 },
} as const satisfies Record<string, WikidataPropertyBase>;

type ApprovedPropertyId = keyof typeof BASE_WIKIDATA_PROPERTIES;

const WIKIDATA_PROPERTY_POLICIES = {
  P26: { label: "spouse", reverseLabel: "spouse", weight: 1.0, traversable: true, maxFanout: 2 },
  P40: { label: "child", reverseLabel: "parent", weight: 1.0, traversable: true, maxFanout: 5 },
  P22: { label: "father", reverseLabel: "child", weight: 1.0, traversable: true, maxFanout: 1 },
  P25: { label: "mother", reverseLabel: "child", weight: 1.0, traversable: true, maxFanout: 1 },
  P27: { label: "country of citizenship", reverseLabel: "citizen", weight: 1.15, traversable: true, maxFanout: 2 },
  P69: { label: "educated at", reverseLabel: "student", weight: 1.4, traversable: true, maxFanout: 5 },
  P108: { label: "employer", reverseLabel: "employs", weight: 1.2, traversable: true, maxFanout: 5, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "employs", reverseDiscoveryFanout: 3 },
  P463: { label: "member of", reverseLabel: "has member", weight: 1.3, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "has member", reverseDiscoveryFanout: 3 },
  P112: { label: "founded by", reverseLabel: "founded", weight: 1.0, traversable: true, maxFanout: 5, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "founded", reverseDiscoveryFanout: 5 },
  P127: { label: "owned by", reverseLabel: "owns", weight: 1.1, traversable: true, maxFanout: 3 },
  P749: { label: "parent organization", reverseLabel: "subsidiary", weight: 1.1, traversable: true, maxFanout: 3 },
  P355: { label: "subsidiary", reverseLabel: "parent organization", weight: 1.1, traversable: true, maxFanout: 5 },
  P159: { label: "headquarters location", reverseLabel: "headquarters of", weight: 1.5, traversable: true, maxFanout: 2 },
  P17: { label: "country", reverseLabel: "contains", weight: 1.3, traversable: true, maxFanout: 2, domainWeights: { "monument/artifact": 1.0, place: 1.15 } },
  P84: { label: "architect", reverseLabel: "architect of", weight: 1.0, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "architect of", reverseDiscoveryFanout: 4 },
  P88: { label: "commissioned by", reverseLabel: "commissioned", weight: 1.1, traversable: true, maxFanout: 3 },
  P131: { label: "located in administrative territorial entity", reverseLabel: "contains", weight: 1.5, traversable: true, maxFanout: 3, domainWeights: { "monument/artifact": 1.3, place: 1.5 } },
  P276: { label: "location", reverseLabel: "location of", weight: 1.2, traversable: true, maxFanout: 3, domainWeights: { "monument/artifact": 1.0, place: 1.3 } },
  P361: { label: "part of", reverseLabel: "has part", weight: 1.6, traversable: true, maxFanout: 3 },
  P495: { label: "country of origin", reverseLabel: "origin of", weight: 1.0, traversable: true, maxFanout: 2 },
  P793: { label: "significant event", reverseLabel: "significant event for", weight: 2.0, traversable: true, maxFanout: 3 },
  P1365: { label: "replaces", reverseLabel: "replaced by", weight: 1.1, traversable: true, maxFanout: 3 },
  P1366: { label: "replaced by", reverseLabel: "replaces", weight: 1.1, traversable: true, maxFanout: 3 },
  P272: { label: "production company", reverseLabel: "produced", weight: 1.2, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "produced", reverseDiscoveryFanout: 5 },
  P750: { label: "distributed by", reverseLabel: "distributed", weight: 1.4, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "distributed", reverseDiscoveryFanout: 3 },
  P449: { label: "original broadcaster", reverseLabel: "broadcast", weight: 1.3, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "broadcast", reverseDiscoveryFanout: 5 },
  P170: { label: "creator", reverseLabel: "created", weight: 1.0, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "created", reverseDiscoveryFanout: 6 },
  P161: { label: "cast member", reverseLabel: "appeared in", weight: 1.6, traversable: true, maxFanout: 8, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "appeared in", reverseDiscoveryFanout: 8 },
  P725: { label: "voice actor", reverseLabel: "voiced", weight: 1.5, traversable: true, maxFanout: 8, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "voiced", reverseDiscoveryFanout: 8 },
  P57: { label: "director", reverseLabel: "directed", weight: 1.1, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "directed", reverseDiscoveryFanout: 5 },
  P58: { label: "screenwriter", reverseLabel: "wrote screenplay for", weight: 1.2, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "wrote screenplay for", reverseDiscoveryFanout: 5 },
  P50: { label: "author", reverseLabel: "wrote", weight: 1.1, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "wrote", reverseDiscoveryFanout: 5 },
  P86: { label: "composer", reverseLabel: "composed", weight: 1.2, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "composed", reverseDiscoveryFanout: 5 },
  P1431: { label: "executive producer", reverseLabel: "executive-produced", weight: 1.3, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "executive-produced", reverseDiscoveryFanout: 4 },
  P162: { label: "producer", reverseLabel: "produced", weight: 1.2, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "produced", reverseDiscoveryFanout: 5 },
  P175: { label: "performer", reverseLabel: "performed", weight: 1.1, traversable: true, maxFanout: 6, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "performed", reverseDiscoveryFanout: 6 },
  P264: { label: "record label", reverseLabel: "label for", weight: 1.4, traversable: true, maxFanout: 4 },
  P767: { label: "contributor", reverseLabel: "contributed to", weight: 1.2, traversable: true, maxFanout: 5, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "contributed to", reverseDiscoveryFanout: 4 },
  P155: { label: "follows", reverseLabel: "followed by", weight: 1.8, traversable: true, maxFanout: 1 },
  P156: { label: "followed by", reverseLabel: "follows", weight: 1.8, traversable: true, maxFanout: 1 },
  P176: { label: "manufacturer", reverseLabel: "manufacturer of", weight: 1.4, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "manufacturer of", reverseDiscoveryFanout: 5 },
  P178: { label: "developer", reverseLabel: "developer of", weight: 1.2, traversable: true, maxFanout: 4 },
  P1441: { label: "present in work", reverseLabel: "features", weight: 5.0, traversable: false, maxFanout: 3 },
  P800: { label: "notable work", reverseLabel: "notable work of", weight: 1.8, traversable: true, maxFanout: 5 },
  P54: { label: "member of sports team", reverseLabel: "has player", weight: 1.2, traversable: true, maxFanout: 8, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "has player", reverseDiscoveryFanout: 8 },
  P118: { label: "league", reverseLabel: "has team or competitor", weight: 1.2, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "has team or competitor", reverseDiscoveryFanout: 4 },
  P286: { label: "head coach", reverseLabel: "coaches", weight: 1.1, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "coaches", reverseDiscoveryFanout: 4 },
  P115: { label: "home venue", reverseLabel: "home venue for", weight: 1.3, traversable: true, maxFanout: 2, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "home venue for", reverseDiscoveryFanout: 4 },
  P859: { label: "sponsor", reverseLabel: "sponsors", weight: 1.5, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "sponsors", reverseDiscoveryFanout: 3 },
  P664: { label: "organizer", reverseLabel: "organized", weight: 1.2, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "organized", reverseDiscoveryFanout: 4 },
  P710: { label: "participant", reverseLabel: "participated in", weight: 1.15, traversable: true, maxFanout: 6, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "participated in", reverseDiscoveryFanout: 3 },
  P1344: { label: "participant in", reverseLabel: "had participant", weight: 1.15, traversable: true, maxFanout: 4, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "had participant", reverseDiscoveryFanout: 3 },
  P137: { label: "operator", reverseLabel: "operates", weight: 1.2, traversable: true, maxFanout: 3, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "operates", reverseDiscoveryFanout: 4 },
  P113: { label: "airline hub", reverseLabel: "hub airline", weight: 1.2, traversable: true, maxFanout: 5, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "hub airline", reverseDiscoveryFanout: 4 },
  P607: { label: "conflict", reverseLabel: "includes conflict", weight: 1.1, traversable: true, maxFanout: 2 },
  P169: { label: "chief executive officer", reverseLabel: "CEO of", weight: 1.1, traversable: true, maxFanout: 2, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "CEO of", reverseDiscoveryFanout: 4 },
  P1056: { label: "produces", reverseLabel: "produced by", weight: 1.3, traversable: true, maxFanout: 5, reverseDiscoveryEnabled: true, reverseDiscoveryLabel: "produced by", reverseDiscoveryFanout: 3 },
  P102: { label: "member of political party", reverseLabel: "political party member", weight: 4.0, traversable: false, maxFanout: 2 },
  P166: { label: "award received", reverseLabel: "recipient", weight: 2.5, traversable: false, maxFanout: 5 },
  P737: { label: "influenced by", reverseLabel: "influenced", weight: 1.3, traversable: true, maxFanout: 5 },
  P138: { label: "named after", reverseLabel: "namesake of", weight: 1.3, traversable: true, maxFanout: 3 },
} as const satisfies Record<ApprovedPropertyId, RelationshipConfig>;

export const APPROVED_WIKIDATA_PROPERTIES = Object.fromEntries(
  (Object.entries(BASE_WIKIDATA_PROPERTIES) as [
    ApprovedPropertyId,
    WikidataPropertyBase,
  ][]).map(([propertyId, property]) => [
    propertyId,
    { ...property, ...WIKIDATA_PROPERTY_POLICIES[propertyId] },
  ]),
) as Record<ApprovedPropertyId, WikidataPropertyConfig>;

export const CURATED_RELATIONSHIP_CONFIG = {
  CO_FOUNDED: { label: "co-founded", reverseLabel: "co-founded by", weight: 1.0, traversable: true },
  FOUNDED: { label: "founded", reverseLabel: "founded by", weight: 1.0, traversable: true },
  ACQUIRED_BY: { label: "acquired by", reverseLabel: "acquired", weight: 1.0, traversable: true },
  CREATED: { label: "created", reverseLabel: "created by", weight: 1.0, traversable: true },
  CEO_OF: { label: "CEO of", reverseLabel: "has CEO", weight: 1.1, traversable: true },
} as const satisfies Record<string, RelationshipConfig>;

const relationshipEntries: [string, RelationshipConfig][] = [
  ...Object.values(APPROVED_WIKIDATA_PROPERTIES).map(
    (config): [string, RelationshipConfig] => [config.relationship, config],
  ),
  ...Object.entries(CURATED_RELATIONSHIP_CONFIG),
];

export const RELATIONSHIP_CONFIG_BY_TYPE: Readonly<
  Record<string, RelationshipConfig>
> = Object.fromEntries(relationshipEntries);

export function getConfiguredRelationshipWeight(
  config: RelationshipConfig,
  sourceDomain: string,
): number {
  return config.domainWeights?.[sourceDomain] ?? config.weight;
}
