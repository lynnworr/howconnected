const property = (id, label, family, supportStatus, options = {}) => ({
  id,
  label,
  family,
  supportStatus,
  sourceDomains: options.sourceDomains ?? ["entity"],
  targetDomains: options.targetDomains ?? ["entity"],
  relevance: options.relevance ?? 3,
  complexity: options.complexity ?? "medium",
  hubRisk: options.hubRisk ?? "medium",
  likelyCodeArea: options.likelyCodeArea ?? "lib/wikidata-properties.ts and lib/discovery-policy.ts",
});

export const EXTERNAL_GAP_SCAN_CONFIG_VERSION = 1;

export const EXTERNAL_GAP_SCAN_PROPERTIES = [
  property("P112", "founded by", "company/founder", "supported", { sourceDomains: ["company/organization", "music organization", "educational institution"], targetDomains: ["person"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P169", "chief executive officer", "people/organizations", "supported", { sourceDomains: ["company/organization"], targetDomains: ["person"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P108", "employer", "people/organizations", "supported", { sourceDomains: ["person", "sports person"], targetDomains: ["company/organization", "educational institution"], relevance: 5, complexity: "medium", hubRisk: "medium" }),
  property("P463", "member of", "people/organizations", "supported", { sourceDomains: ["person", "company/organization"], targetDomains: ["company/organization"], relevance: 4, complexity: "medium", hubRisk: "high" }),

  property("P161", "cast member", "person/work", "supported", { sourceDomains: ["film", "television series"], targetDomains: ["person"], relevance: 5, complexity: "medium", hubRisk: "medium" }),
  property("P725", "voice actor", "person/work", "supported", { sourceDomains: ["film", "television series"], targetDomains: ["person"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
  property("P57", "director", "creator/work", "supported", { sourceDomains: ["film"], targetDomains: ["person"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P58", "screenwriter", "creator/work", "supported", { sourceDomains: ["film", "television series"], targetDomains: ["person"], relevance: 4, complexity: "low", hubRisk: "low" }),
  property("P162", "producer", "music/producer/performer", "supported", { sourceDomains: ["film", "television series", "music/work"], targetDomains: ["person", "music artist"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
  property("P175", "performer", "music/producer/performer", "supported", { sourceDomains: ["music/work"], targetDomains: ["music artist"], relevance: 5, complexity: "medium", hubRisk: "medium" }),
  property("P86", "composer", "music/producer/performer", "supported", { sourceDomains: ["film", "television series", "music/work"], targetDomains: ["person", "music artist"], relevance: 4, complexity: "low", hubRisk: "low" }),
  property("P264", "record label", "music/producer/performer", "partially-supported", { sourceDomains: ["music/work", "music artist"], targetDomains: ["music organization"], relevance: 4, complexity: "medium", hubRisk: "medium" }),

  property("P641", "sport", "sport/team/league", "partially-supported", { sourceDomains: ["sports team", "sports person", "event"], targetDomains: ["entity"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P118", "league", "sport/team/league", "supported", { sourceDomains: ["sports team", "sports person", "event"], targetDomains: ["event", "entity"], relevance: 5, complexity: "medium", hubRisk: "medium" }),
  property("P54", "member of sports team", "sport/team/league", "supported", { sourceDomains: ["sports person", "person"], targetDomains: ["sports team"], relevance: 5, complexity: "medium", hubRisk: "high" }),
  property("P286", "head coach", "sport/team/league", "supported", { sourceDomains: ["sports team"], targetDomains: ["sports person", "person"], relevance: 4, complexity: "low", hubRisk: "low" }),
  property("P115", "home venue", "sport/team/league", "supported", { sourceDomains: ["sports team", "event", "place"], targetDomains: ["place", "monument/artifact"], relevance: 4, complexity: "medium", hubRisk: "medium" }),

  property("P176", "manufacturer", "product/manufacturer", "supported", { sourceDomains: ["product", "transportation"], targetDomains: ["company/organization"], relevance: 5, complexity: "medium", hubRisk: "medium" }),
  property("P1056", "product or material produced", "product/manufacturer", "supported", { sourceDomains: ["company/organization"], targetDomains: ["product"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
  property("P127", "owned by", "company/hierarchy", "partially-supported", { sourceDomains: ["company/organization", "product", "transportation"], targetDomains: ["company/organization", "person"], relevance: 5, complexity: "medium", hubRisk: "high" }),
  property("P749", "parent organization", "company/hierarchy", "partially-supported", { sourceDomains: ["company/organization", "music organization"], targetDomains: ["company/organization"], relevance: 5, complexity: "medium", hubRisk: "medium" }),

  property("P17", "country", "place/country", "partially-supported", { sourceDomains: ["place", "monument/artifact", "historical event"], targetDomains: ["place"], relevance: 3, complexity: "low", hubRisk: "high" }),
  property("P276", "location", "place/country", "partially-supported", { sourceDomains: ["monument/artifact", "historical event"], targetDomains: ["place"], relevance: 4, complexity: "medium", hubRisk: "high" }),
  property("P131", "located in administrative entity", "place/country", "partially-supported", { sourceDomains: ["place", "monument/artifact", "historical event"], targetDomains: ["place"], relevance: 3, complexity: "medium", hubRisk: "high" }),
  property("P495", "country of origin", "place/country", "partially-supported", { sourceDomains: ["product", "music/work", "film"], targetDomains: ["place"], relevance: 3, complexity: "low", hubRisk: "high" }),
  property("P170", "creator", "creator/work", "supported", { sourceDomains: ["monument/artifact", "music/work", "product"], targetDomains: ["person", "company/organization"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P84", "architect", "creator/work", "supported", { sourceDomains: ["monument/artifact"], targetDomains: ["person", "company/organization"], relevance: 4, complexity: "low", hubRisk: "low" }),

  property("P710", "participant", "event/participant", "supported", { sourceDomains: ["event", "historical event"], targetDomains: ["person", "company/organization", "place"], relevance: 4, complexity: "medium", hubRisk: "high" }),
  property("P1344", "participant in", "event/participant", "supported", { sourceDomains: ["person", "sports person"], targetDomains: ["event", "historical event"], relevance: 4, complexity: "medium", hubRisk: "high" }),
  property("P607", "conflict", "event/participant", "partially-supported", { sourceDomains: ["person", "historical event"], targetDomains: ["historical event"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
  property("P664", "organizer", "event/participant", "supported", { sourceDomains: ["event", "historical event", "company/organization"], targetDomains: ["person", "company/organization"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
  property("P793", "significant event", "event/participant", "partially-supported", { sourceDomains: ["monument/artifact", "historical event"], targetDomains: ["event", "historical event"], relevance: 3, complexity: "medium", hubRisk: "medium" }),

  property("P137", "operator", "transportation/operator", "supported", { sourceDomains: ["transportation", "place", "company/organization"], targetDomains: ["company/organization"], relevance: 5, complexity: "medium", hubRisk: "medium" }),
  property("P113", "airline hub", "transportation/operator", "supported", { sourceDomains: ["transportation", "company/organization"], targetDomains: ["place"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
  property("P361", "part of", "transportation/operator", "partially-supported", { sourceDomains: ["transportation", "product", "place"], targetDomains: ["transportation", "company/organization", "place"], relevance: 3, complexity: "high", hubRisk: "high" }),

  property("P178", "developer", "software/games", "partially-supported", { sourceDomains: ["product"], targetDomains: ["company/organization", "person"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P123", "publisher", "software/games", "unsupported", { sourceDomains: ["product", "music/work"], targetDomains: ["company/organization"], relevance: 5, complexity: "low", hubRisk: "low" }),
  property("P400", "platform", "software/games", "unsupported", { sourceDomains: ["product"], targetDomains: ["product"], relevance: 5, complexity: "medium", hubRisk: "high" }),
  property("P179", "part of the series", "software/games", "unsupported", { sourceDomains: ["product", "film", "television series"], targetDomains: ["product", "television series"], relevance: 4, complexity: "medium", hubRisk: "medium" }),
];

export const EXTERNAL_GAP_SCAN_PROPERTY_IDS = EXTERNAL_GAP_SCAN_PROPERTIES.map(({ id }) => id);

export function externalPropertyConfig(propertyId) {
  return EXTERNAL_GAP_SCAN_PROPERTIES.find(({ id }) => id === propertyId) ?? null;
}
