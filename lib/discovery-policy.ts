import type { EntityDomain } from "./entity-domain.ts";
import type { WikidataPropertyConfig } from "./wikidata-properties.ts";

const OUTGOING_PROPERTIES: Readonly<Record<EntityDomain, readonly string[]>> = {
  person: ["P26", "P40", "P22", "P25", "P69", "P108", "P463", "P800", "P54", "P1344", "P175", "P737"],
  "sports person": ["P54", "P108", "P69", "P1344", "P26", "P40", "P800"],
  film: ["P161", "P57", "P58", "P86", "P1431", "P162", "P272", "P750", "P170", "P175"],
  "television series": ["P161", "P725", "P170", "P58", "P86", "P1431", "P162", "P272", "P449", "P750"],
  "music/work": ["P175", "P50", "P86", "P264", "P272", "P750", "P170", "P176", "P178"],
  "sports team": ["P118", "P286", "P127", "P115", "P169", "P749", "P859", "P54"],
  "company/organization": ["P112", "P169", "P355", "P749", "P127", "P1056", "P176", "P137", "P859", "P664", "P463"],
  "government/scientific organization": ["P112", "P169", "P355", "P749", "P127", "P1056", "P137", "P664", "P463"],
  "educational institution": ["P112", "P169", "P749", "P108", "P463", "P159"],
  place: ["P115", "P159", "P137", "P664"],
  event: ["P664", "P710", "P859", "P137", "P115", "P272"],
  product: ["P176", "P127", "P749", "P178", "P1056"],
  entity: ["P26", "P108", "P112", "P127", "P749", "P161", "P725", "P57", "P50", "P175", "P176", "P178", "P800", "P54"],
};

const REVERSE_PROPERTIES: Readonly<Record<EntityDomain, readonly string[]>> = {
  person: ["P161", "P725", "P57", "P58", "P50", "P175", "P1431", "P162", "P112", "P169"],
  "sports person": ["P54", "P161", "P725", "P710"],
  film: [],
  "television series": [],
  "music/work": [],
  "sports team": ["P54", "P859"],
  "company/organization": ["P272", "P750", "P449", "P108", "P463", "P859", "P664", "P137", "P176"],
  "government/scientific organization": ["P108", "P463", "P664", "P137", "P272"],
  "educational institution": ["P69", "P108", "P463"],
  place: ["P115", "P159", "P664"],
  event: ["P1344"],
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
): WikidataPropertyConfig[] {
  return selectConfiguredProperties(OUTGOING_PROPERTIES[domain], properties);
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
