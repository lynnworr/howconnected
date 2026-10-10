import type { EntityDomain } from "./entity-domain.ts";
import type { WikidataPropertyConfig } from "./wikidata-properties.ts";

const OUTGOING_PROPERTIES: Readonly<Record<EntityDomain, readonly string[]>> = {
  person: ["P26", "P40", "P22", "P25", "P27", "P69", "P108", "P463", "P800", "P54", "P1344", "P607", "P175", "P737"],
  "sports person": ["P641", "P54", "P108", "P69", "P1344", "P26", "P40", "P800"],
  film: ["P161", "P57", "P58", "P86", "P1431", "P162", "P272", "P750", "P170", "P175", "P179", "P123"],
  "television series": ["P161", "P725", "P170", "P58", "P86", "P1431", "P162", "P272", "P449", "P750", "P179", "P123"],
  "music artist": ["P175", "P264", "P800", "P361", "P463", "P108", "P737"],
  "music organization": ["P112", "P127", "P749", "P355", "P361", "P264"],
  "music/work": ["P175", "P162", "P86", "P767", "P264", "P155", "P156", "P361", "P50", "P272", "P750", "P170", "P176", "P178", "P179", "P123"],
  "creative work": ["P50", "P170", "P178", "P123", "P400", "P179", "P176", "P361", "P155", "P156", "P272", "P750", "P86"],
  "monument/artifact": ["P495", "P276", "P17", "P170", "P84", "P88", "P131", "P793", "P361"],
  "sports team": ["P641", "P118", "P286", "P127", "P115", "P169", "P749", "P859", "P54"],
  "company/organization": ["P641", "P112", "P169", "P355", "P749", "P127", "P1056", "P176", "P137", "P859", "P664", "P463"],
  "government/scientific organization": ["P112", "P169", "P355", "P749", "P127", "P1056", "P137", "P664", "P463"],
  "educational institution": ["P112", "P169", "P749", "P108", "P463", "P159"],
  place: ["P17", "P1365", "P1366", "P361", "P131", "P115", "P159", "P137", "P664"],
  event: ["P641", "P664", "P710", "P859", "P137", "P115", "P272"],
  "historical event": ["P710", "P607", "P137", "P276", "P131", "P17", "P664", "P793", "P361"],
  transportation: ["P176", "P137", "P113", "P127", "P749", "P361", "P17"],
  product: ["P176", "P127", "P749", "P178", "P123", "P400", "P179", "P1056"],
  entity: ["P641", "P26", "P108", "P112", "P127", "P749", "P161", "P725", "P57", "P50", "P175", "P176", "P178", "P800", "P54"],
};

const REVERSE_PROPERTIES: Readonly<Record<EntityDomain, readonly string[]>> = {
  person: ["P161", "P725", "P57", "P58", "P50", "P175", "P84", "P86", "P1431", "P162", "P112", "P169"],
  "sports person": ["P54", "P161", "P725", "P710"],
  film: [],
  "television series": [],
  "music artist": ["P175", "P162", "P86", "P767"],
  "music organization": ["P264", "P127", "P749"],
  "music/work": [],
  "creative work": [],
  "monument/artifact": [],
  "sports team": ["P54", "P859"],
  "company/organization": ["P272", "P750", "P449", "P108", "P463", "P859", "P664", "P137", "P176"],
  "government/scientific organization": ["P108", "P463", "P664", "P137", "P272"],
  "educational institution": ["P69", "P108", "P463"],
  place: ["P115", "P159", "P664"],
  event: ["P1344"],
  "historical event": ["P1344", "P710"],
  transportation: ["P137", "P113", "P176"],
  product: ["P1056"],
  entity: ["P161", "P725", "P54", "P112"],
};

function selectConfiguredProperties(
  propertyIds: readonly string[],
  properties: readonly WikidataPropertyConfig[],
): WikidataPropertyConfig[] {
  const byId = new Map(properties.map((property) => [property.wikidataProperty, property]));
  return propertyIds.flatMap((propertyId) => {
    const property = byId.get(propertyId);
    return property ? [property] : [];
  });
}

export function selectOutgoingDiscoveryProperties(
  domain: EntityDomain,
  properties: readonly WikidataPropertyConfig[],
  context: {
    availablePropertyIds?: readonly string[];
    explicitTargetPropertyIds?: readonly string[];
  } = {},
): WikidataPropertyConfig[] {
  const contextualPropertyIds = [
    "P276", "P793", "P137", "P361", "P131",
    "P1344", "P84", "P86", "P710", "P112", "P286",
  ].filter((propertyId) => context.availablePropertyIds?.includes(propertyId));
  return selectConfiguredProperties(
    [
      ...new Set([
        ...(context.explicitTargetPropertyIds ?? []),
        ...OUTGOING_PROPERTIES[domain],
        ...contextualPropertyIds,
      ]),
    ],
    properties,
  );
}

export function selectIncomingDiscoveryProperties(
  domain: EntityDomain,
  properties: readonly WikidataPropertyConfig[],
  limit: number,
): WikidataPropertyConfig[] {
  return selectConfiguredProperties(REVERSE_PROPERTIES[domain], properties)
    .filter((property) => property.reverseDiscoveryEnabled)
    .slice(0, limit);
}

export const DISCOVERY_PROPERTY_FAMILIES = {
  outgoing: OUTGOING_PROPERTIES,
  incoming: REVERSE_PROPERTIES,
} as const;
