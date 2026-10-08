export const ENTITY_DOMAINS = [
  "person",
  "company/organization",
  "film",
  "television series",
  "music artist",
  "music organization",
  "music/work",
  "monument/artifact",
  "sports team",
  "sports person",
  "educational institution",
  "place",
  "event",
  "historical event",
  "transportation",
  "product",
  "government/scientific organization",
  "entity",
] as const;

export type EntityDomain = (typeof ENTITY_DOMAINS)[number];

type DomainInput = {
  instanceOfQids?: readonly string[];
  type?: string;
  name?: string;
  description?: string;
};

const INSTANCE_DOMAINS: Readonly<Record<string, EntityDomain>> = {
  Q5: "person",
  Q11424: "film",
  Q5398426: "television series",
  Q15416: "television series",
  Q482994: "music/work",
  Q7366: "music/work",
  Q2188189: "music/work",
  Q215380: "music organization",
  Q2088357: "music organization",
  Q198: "historical event",
  Q178561: "historical event",
  Q3839081: "historical event",
  Q13418847: "historical event",
  Q273120: "historical event",
  Q131569: "historical event",
  Q5916: "historical event",
  Q11436: "transportation",
  Q210932: "transportation",
  Q15056993: "transportation",
  Q40218: "transportation",
  Q25956: "transportation",
  Q3231690: "transportation",
  Q1420: "transportation",
  Q11446: "transportation",
  Q1248784: "transportation",
  Q46970: "transportation",
  Q870: "transportation",
  Q179700: "monument/artifact",
  Q1779653: "monument/artifact",
  Q1440300: "monument/artifact",
  Q1440476: "monument/artifact",
  Q2319498: "monument/artifact",
  Q3305213: "monument/artifact",
  Q153562: "monument/artifact",
  Q38048707: "monument/artifact",
  Q860861: "monument/artifact",
  Q4989906: "monument/artifact",
  Q811979: "monument/artifact",
  Q838948: "monument/artifact",
  Q220659: "monument/artifact",
  Q12973014: "sports team",
  Q476028: "sports team",
  Q847017: "sports team",
  Q3918: "educational institution",
  Q2385804: "educational institution",
  Q515: "place",
  Q6256: "place",
  Q486972: "place",
  Q1656682: "event",
  Q2424752: "product",
  Q327333: "government/scientific organization",
  Q2659904: "government/scientific organization",
  Q16519632: "government/scientific organization",
  Q43229: "company/organization",
  Q4830453: "company/organization",
  Q783794: "company/organization",
};

export function isEntityDomain(value: string): value is EntityDomain {
  return (ENTITY_DOMAINS as readonly string[]).includes(value);
}

export function classifyEntityDomain(input: DomainInput): EntityDomain {
  const value = `${input.type ?? ""} ${input.name ?? ""} ${input.description ?? ""}`
    .trim()
    .toLowerCase();

  if (/athlete|footballer|basketball player|baseball player|hockey player|sportsperson|sports player/.test(value)) {
    return "sports person";
  }
  if (/singer|musician|rapper|record producer|songwriter|music composer|musical artist/.test(value)) {
    return "music artist";
  }
  if (input.type && input.type !== "entity" && isEntityDomain(input.type)) {
    return input.type;
  }
  for (const qid of input.instanceOfQids ?? []) {
    const domain = INSTANCE_DOMAINS[qid];
    if (domain) return domain;
  }
  if (/sports team|football club|basketball team|baseball team|hockey team|nfl franchise|nba team/.test(value)) {
    return "sports team";
  }
  if (/government agency|space agency|scientific organization|research agency|aeronautics agency/.test(value)) {
    return "government/scientific organization";
  }
  if (/television series|tv series|animated series|television program/.test(value)) {
    return "television series";
  }
  if (/record label|music group|musical group|\bband\b|audio streaming|music streaming|music company/.test(value)) {
    return "music organization";
  }
  if (
    /world war|global war|civil war|\bbattle\b|armed conflict|revolution|historical event|disaster|terrorist attack|political crisis|protest|uprising|treaty|peace conference|spaceflight|geopolitical tension/.test(
      value,
    )
  ) {
    return "historical event";
  }
  if (
    /aircraft|airliner|spacecraft|space station|automobile|motor vehicle|vehicle model|\bship\b|ocean liner|airport|airline|railway|\btrain\b|locomotive/.test(
      value,
    )
  ) {
    return "transportation";
  }
  if (
    /monument|statue|sculpture|painting|artwork|work of art|architectural landmark|built structure|cultural heritage|opera house|observation tower|lattice tower/.test(
      value,
    )
  ) {
    return "monument/artifact";
  }
  if (/\bfilm\b|motion picture|feature film/.test(value)) return "film";
  if (/album|song|musical work|recording|creative work|book|novel|video game/.test(value)) {
    return "music/work";
  }
  if (/university|college|educational institution|school/.test(value)) {
    return "educational institution";
  }
  if (/company|corporation|organization|organisation|business|studio|network|broadcaster/.test(value)) {
    return "company/organization";
  }
  if (/stadium|arena|venue|city|country|river|place|location|\bnation\b|historical state|city-state|republic|kingdom/.test(value)) {
    return "place";
  }
  if (/event|tournament|festival|ceremony|conference/.test(value)) return "event";
  if (/product|device|vehicle|brand|software/.test(value)) return "product";

  if (/actor|actress|person|human|writer|director|singer|musician|entrepreneur|executive/.test(value)) {
    return "person";
  }
  return "entity";
}

export function domainBridgePenalty(
  domain: EntityDomain,
  oppositeDomain: EntityDomain,
): number {
  if (domain === "entity") return 0.65;
  if (domain === oppositeDomain) return -0.2;

  const bridgeDomains = new Set<EntityDomain>([
    "person",
    "company/organization",
    "film",
    "television series",
    "music/work",
    "music artist",
    "music organization",
    "monument/artifact",
    "sports person",
    "event",
    "historical event",
    "transportation",
  ]);
  if (bridgeDomains.has(domain)) return -0.35;
  if (domain === "government/scientific organization") return -0.2;
  if (domain === "educational institution") return 0;
  if (domain === "place" && ["sports team", "company/organization"].includes(oppositeDomain)) {
    return 0;
  }
  return 0.2;
}
