import type { ConnectionPathData } from "@/components/connection-types";

export type RelationshipCategory = {
  key: string;
  label: string;
};

const CATEGORY_RULES: Array<RelationshipCategory & { pattern: RegExp }> = [
  {
    key: "family",
    label: "family",
    pattern: /spouse|child|parent|father|mother/i,
  },
  {
    key: "creative",
    label: "creative-work and media",
    pattern:
      /appear|cast|actor|voice|film|work|author|writ|director|composer|perform|produc|broadcast|distribut|record label|creator|contributor/i,
  },
  {
    key: "organization",
    label: "organization and ownership",
    pattern:
      /employ|member|found|own|subsidiary|parent organization|acquir|chief executive|CEO|sponsor|operator|manufacturer|developer/i,
  },
  {
    key: "place",
    label: "place and location",
    pattern:
      /country|location|located|headquarters|venue|hub|territorial|origin/i,
  },
  {
    key: "education",
    label: "education",
    pattern: /educat|student/i,
  },
  {
    key: "sports",
    label: "sports and competition",
    pattern: /sports|team|league|coach|participant|organizer/i,
  },
  {
    key: "history",
    label: "events and chronology",
    pattern: /event|conflict|replac|follow/i,
  },
  {
    key: "influence",
    label: "influence and recognition",
    pattern: /influenc|award|named after|namesake|architect|commission/i,
  },
];

const GENERAL_CATEGORY: RelationshipCategory = {
  key: "general",
  label: "general structured",
};

function naturalList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function finishSentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function normalizedSteps(path: ConnectionPathData): number {
  return path.relationships.length || path.steps;
}

function stablePathHash(path: ConnectionPathData): number {
  const signature = [
    ...path.nodes.map((node) => node.qid ?? node.name),
    ...path.relationships.map((relationship) => relationship.label),
  ].join("|");

  let hash = 0;
  for (const character of signature) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getRelationshipCategories(
  path: ConnectionPathData,
): RelationshipCategory[] {
  const categories = path.relationships.map((relationship) => {
    return (
      CATEGORY_RULES.find(({ pattern }) => pattern.test(relationship.label)) ??
      GENERAL_CATEGORY
    );
  });

  return categories.filter(
    (category, index) =>
      categories.findIndex((candidate) => candidate.key === category.key) ===
      index,
  );
}

export function generateConnectionExplanation(path: ConnectionPathData): string {
  const start = path.nodes[0]?.name;
  const end = path.nodes.at(-1)?.name;
  if (!start || !end || path.relationships.length === 0) return "";

  const intermediaryNames = path.nodes.slice(1, -1).map((node) => node.name);
  const opening = finishSentence(
    intermediaryNames.length > 0
      ? `${start} and ${end} are connected through ${naturalList(intermediaryNames)}`
      : `${start} and ${end} are directly connected in the returned path`,
  );
  const route = path.relationships
    .map((relationship, index) => {
      const from = path.nodes[index]?.name ?? relationship.from;
      const to = path.nodes[index + 1]?.name ?? relationship.to;
      return `${from} — ${relationship.label} — ${to}`;
    })
    .join("; then ");
  const steps = normalizedSteps(path);

  return `${opening} ${finishSentence(`Reading the relationship labels in order, the route is ${route}`)} That brings the two endpoints together in ${steps} ${steps === 1 ? "step" : "steps"}—a small tour of the knowledge graph along the way.`;
}

export function generateWhyPathWorks(path: ConnectionPathData): string {
  const categories = getRelationshipCategories(path).map(
    (category) => category.label,
  );
  const categorySummary = naturalList(categories);

  return `Each step comes from a structured relationship in Wikidata. This chain moves through ${categorySummary} relationships.`;
}

export function selectFunTemplate(path: ConnectionPathData): number {
  const applicableTemplateCount = path.nodes.length > 2 ? 4 : 3;
  return stablePathHash(path) % applicableTemplateCount;
}

export function generateFunTakeaway(path: ConnectionPathData): string {
  const steps = normalizedSteps(path);
  const intermediaryNames = path.nodes.slice(1, -1).map((node) => node.name);
  const uniqueLabels = new Set(
    path.relationships.map((relationship) => relationship.label.toLowerCase()),
  ).size;
  const templates = [
    `${steps} ${steps === 1 ? "step" : "steps"}, ${intermediaryNames.length} ${intermediaryNames.length === 1 ? "stop" : "stops"} in the middle, and one complete chain.`,
    `This route uses ${uniqueLabels} distinct relationship ${uniqueLabels === 1 ? "label" : "labels"}. The knowledge graph kept the itinerary precise.`,
    `${path.nodes[0]?.name ?? "One endpoint"} to ${path.nodes.at(-1)?.name ?? "the other endpoint"} in ${steps} ${steps === 1 ? "move" : "moves"}. That is the whole route, no invented detours required.`,
    `The middle of this route is ${naturalList(intermediaryNames.slice(0, 2))}${intermediaryNames.length > 2 ? " and a few more stops" : ""}. The path took the scenic option.`,
  ];

  return templates[selectFunTemplate(path)];
}

export function buildConnectionSeoDescription(
  path: ConnectionPathData,
  sourceName = path.nodes[0]?.name ?? "the first entity",
  targetName = path.nodes.at(-1)?.name ?? "the second entity",
): string {
  const steps = normalizedSteps(path);
  const intermediaries = path.nodes
    .slice(1, -1)
    .map((node) => node.name)
    .slice(0, 2);
  const suffix =
    intermediaries.length > 0
      ? ` through ${naturalList(intermediaries)}`
      : "";
  const detailed = finishSentence(
    `Discover how ${sourceName} connects to ${targetName} in ${steps} ${steps === 1 ? "step" : "steps"}${suffix}`,
  );

  if (detailed.length <= 160) return detailed;
  return finishSentence(
    `Discover how ${sourceName} connects to ${targetName} in ${steps} ${steps === 1 ? "step" : "steps"}`,
  );
}
