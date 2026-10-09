const family = (id, label, relationships, options = {}) => ({
  id,
  label,
  relationships,
  relevance: options.relevance ?? 3,
  complexity: options.complexity ?? "medium",
  likelyFix: options.likelyFix ?? "Review property selection and reverse traversal policy.",
});

const relation = (property, queryDirection = "reverse", options = {}) => ({
  property,
  queryDirection,
  sourceDomains: options.sourceDomains ?? [],
  targetDomains: options.targetDomains ?? [],
  sourcePattern: options.sourcePattern ?? null,
  targetPattern: options.targetPattern ?? null,
  sourceExcludePattern: options.sourceExcludePattern ?? null,
  targetExcludePattern: options.targetExcludePattern ?? null,
});

export const GAP_SCAN_FAMILIES = [
  family("person-organization", "person ↔ organization", [
    relation("P108", "reverse", { sourceDomains: ["person", "sports person"] }),
    relation("P463", "reverse", { sourceDomains: ["person", "sports person"] }),
    relation("P169", "forward", { targetDomains: ["person"] }),
  ], { relevance: 5, complexity: "medium", likelyFix: "Tune employer, membership, and leadership reverse discovery by entity domain." }),
  family("person-work", "person ↔ work", [
    relation("P800", "forward", { sourceDomains: ["person", "sports person", "music artist"] }),
  ], { relevance: 4, complexity: "low", likelyFix: "Ensure notable-work edges are selected for people and remain acceptable when traversed in reverse." }),
  family("actor-work", "actor ↔ work", [
    relation("P161", "reverse"),
    relation("P725", "reverse"),
  ], { relevance: 5, complexity: "medium", likelyFix: "Improve bounded cast and voice-actor reverse coverage." }),
  family("creator-work", "creator ↔ work", [
    relation("P170", "reverse"),
    relation("P50", "reverse"),
  ], { relevance: 5, complexity: "low", likelyFix: "Enable or prioritize creator and author edges for the relevant work domains." }),
  family("performer-work", "performer ↔ work", [
    relation("P175", "reverse"),
  ], { relevance: 4, complexity: "medium", likelyFix: "Tune performer reverse discovery and work-domain property selection." }),
  family("producer-work", "producer ↔ work", [
    relation("P162", "reverse"),
    relation("P1431", "reverse"),
  ], { relevance: 4, complexity: "medium", likelyFix: "Improve producer and executive-producer reverse coverage." }),
  family("sport-team", "sport ↔ team", [
    relation("P641", "reverse", { sourceDomains: ["sports team"] }),
    relation("P641", "reverse", { sourcePattern: "team|club|franchise" }),
  ], { relevance: 5, complexity: "low", likelyFix: "Select the sport property for teams and preserve its reverse label without broad inverse lookups." }),
  family("team-league", "team ↔ league", [
    relation("P118", "reverse", { sourceDomains: ["sports team", "sports person", "event", "entity"] }),
  ], { relevance: 5, complexity: "medium", likelyFix: "Tune league property selection and bounded reverse membership discovery." }),
  family("league-sport", "league ↔ sport", [
    relation("P641", "forward", { sourcePattern: "league|conference|division|competition", sourceExcludePattern: "team|club|franchise" }),
  ], { relevance: 5, complexity: "low", likelyFix: "Classify sports leagues consistently and select their explicit sport property." }),
  family("product-manufacturer", "product ↔ manufacturer", [
    relation("P176", "reverse", { sourceDomains: ["product", "transportation", "music/work", "entity"] }),
  ], { relevance: 4, complexity: "medium", likelyFix: "Tune manufacturer reverse discovery for products and transportation entities." }),
  family("company-founder", "company ↔ founder", [
    relation("P112", "reverse", { sourceDomains: ["company/organization", "government/scientific organization", "music organization", "educational institution", "entity"] }),
  ], { relevance: 5, complexity: "low", likelyFix: "Enable and prioritize founder reverse traversal for organizations." }),
  family("company-hierarchy", "company ↔ parent/subsidiary", [
    relation("P127", "reverse"),
    relation("P749", "reverse"),
    relation("P355", "reverse"),
  ], { relevance: 5, complexity: "medium", likelyFix: "Normalize parent, owner, and subsidiary selection across organization domains." }),
  family("artwork-creator", "monument/artwork ↔ creator", [
    relation("P170", "reverse", { sourceDomains: ["monument/artifact"] }),
    relation("P84", "reverse", { sourceDomains: ["monument/artifact"] }),
  ], { relevance: 4, complexity: "low", likelyFix: "Select creator and architect properties for monuments and artworks." }),
  family("artwork-location", "monument/artwork ↔ country/location", [
    relation("P17", "forward", { sourceDomains: ["monument/artifact"] }),
    relation("P276", "forward", { sourceDomains: ["monument/artifact"] }),
    relation("P131", "forward", { sourceDomains: ["monument/artifact"] }),
    relation("P495", "forward", { sourceDomains: ["monument/artifact"] }),
  ], { relevance: 4, complexity: "medium", likelyFix: "Tune geographic properties only for artifact and monument domains." }),
  family("historical-event-participant", "historical event ↔ participant", [
    relation("P710", "reverse", { sourceDomains: ["historical event", "event"] }),
    relation("P1344", "forward", { targetDomains: ["historical event", "event"] }),
  ], { relevance: 4, complexity: "medium", likelyFix: "Improve bounded participant and participant-in coverage for historical events." }),
  family("event-location", "event ↔ location", [
    relation("P276", "forward", { sourceDomains: ["event", "historical event"] }),
    relation("P131", "forward", { sourceDomains: ["event", "historical event"] }),
  ], { relevance: 3, complexity: "low", likelyFix: "Select explicit event location properties for event domains." }),
  family("transportation-operator-manufacturer", "transportation ↔ operator/manufacturer", [
    relation("P137", "reverse", { sourceDomains: ["transportation"] }),
    relation("P176", "reverse", { sourceDomains: ["transportation"] }),
    relation("P113", "reverse", { sourceDomains: ["transportation"] }),
  ], { relevance: 4, complexity: "medium", likelyFix: "Tune operator, manufacturer, and airline-hub reverse coverage." }),
  family("education-person", "educational institution ↔ person", [
    relation("P69", "reverse", { sourceDomains: ["person", "sports person", "music artist"] }),
  ], { relevance: 4, complexity: "medium", likelyFix: "Improve bounded educated-at reverse coverage for institutions." }),
  family("software-developer-publisher", "software/game ↔ developer/publisher", [
    relation("P178", "reverse", { sourceDomains: ["product", "music/work", "entity"] }),
    relation("P176", "reverse", { sourceDomains: ["product", "music/work", "entity"] }),
    relation("P272", "reverse", { sourceDomains: ["music/work"] }),
    relation("P750", "reverse", { sourceDomains: ["music/work", "product", "entity"] }),
  ], { relevance: 5, complexity: "medium", likelyFix: "Tune developer, publisher, production, and distribution edges for software and games." }),
];

export const GAP_SCAN_TWO_HOP_TEMPLATES = [
  { id: "sport-league-team", label: "sport → league → team", properties: ["P641", "P118"], relevance: 5 },
  { id: "person-organization-hierarchy", label: "person → organization → parent", properties: ["P108", "P749"], relevance: 4 },
  { id: "product-manufacturer-hierarchy", label: "product → manufacturer → parent", properties: ["P176", "P749"], relevance: 4 },
  { id: "performer-producer-work", label: "performer → work → producer", properties: ["P175", "P162"], relevance: 3 },
  { id: "participant-event-location", label: "participant → event → location", properties: ["P710", "P276"], relevance: 3 },
];

export const GAP_SCAN_CONFIG_VERSION = 2;

export const GAP_SCAN_PROPERTY_IDS = [...new Set(
  GAP_SCAN_FAMILIES.flatMap((entry) => entry.relationships.map(({ property }) => property)),
)];
