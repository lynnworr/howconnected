export const ENTITY_DOMAINS = [
  "person",
  "company/organization",
  "film",
  "television series",
  "music/work",
  "sports team",
  "sports person",
  "educational institution",
  "place",
  "event",
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
  if (/stadium|arena|venue|city|country|river|place|location/.test(value)) {
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
    "sports person",
    "event",
  ]);
  if (bridgeDomains.has(domain)) return -0.35;
  if (domain === "government/scientific organization") return -0.2;
  if (domain === "educational institution") return 0;
  if (domain === "place" && ["sports team", "company/organization"].includes(oppositeDomain)) {
    return 0;
  }
  return 0.2;
}
