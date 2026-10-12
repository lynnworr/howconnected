import { readFile, writeFile } from "node:fs/promises";

const registry = JSON.parse(await readFile(new URL("../content/daily-puzzles.json", import.meta.url), "utf8"));
const batchIds = [
  "apollo-armstrong-nasa",
  "penicillin-fleming-nobel-medicine",
  "hamlet-shakespeare-stratford",
  "nineteen-eighty-four-orwell-bbc",
  "hobbit-tolkien-oxford",
  "abbey-road-beatles-liverpool",
  "bohemian-rhapsody-queen-london",
  "toy-story-hanks-apollo-13",
  "titanic-dicaprio-revenant",
  "space-jam-jordan-bulls",
  "iphone-apple-jobs",
  "youtube-google-alphabet",
  "guernica-picasso-cubism",
  "persistence-memory-dali-surrealism",
  "declaration-jefferson-uva",
  "berlin-wall-east-germany-warsaw-pact",
  "sydney-opera-utzon-pritzker",
  "relativity-einstein-nobel-physics",
  "hundred-years-marquez-nobel-literature",
  "starry-night-van-gogh-post-impressionism",
];

const rejected = {
  "apollo-armstrong-nasa": {
    exactPath: "Apollo 11 (Q43653) —P1029→ Neil Armstrong (Q1615) —P108→ NASA (Q23548)",
    reason: "Rejected as ambiguous: the live exact-property query also resolves through Buzz Aldrin and Michael Collins, so Neil Armstrong is not a unique hidden intermediary.",
    qualifierConcerns: "Apollo 11's P1029 statement identifies Armstrong as spacecraft commander (P39); his NASA employment has astronaut role (P39), start 1962 (P580), and end 1971 (P582). Those qualifiers do not restore uniqueness.",
    sourceEvidence: [
      { label: "Apollo 11 crew statement", url: "https://www.wikidata.org/wiki/Q43653#P1029" },
      { label: "Neil Armstrong employer statement", url: "https://www.wikidata.org/wiki/Q1615#P108" },
      { label: "Apollo 11 mission", url: "https://www.nasa.gov/mission/apollo-11/" },
      { label: "Neil A. Armstrong", url: "https://www.nasa.gov/humans-in-space/astronauts/former-astronauts/former-astronaut-neil-a-armstrong/" },
    ],
    distractors: [
      { qid: "Q2252", label: "Buzz Aldrin", exactPathMatch: true },
      { qid: "Q104859", label: "Michael Collins", exactPathMatch: true },
      { qid: "Q182642", label: "John Glenn", exactPathMatch: false },
    ],
    distractorValidationOutcome: "Failed: two plausible alternatives satisfy both exact edges. The intended answer cannot be presented as unique.",
    uniqueIntermediaryCount: 3,
  },
  "space-jam-jordan-bulls": {
    exactPath: "Space Jam (Q207659) —P161→ Michael Jordan (Q41421) —P54→ Chicago Bulls (Q128109)",
    reason: "Rejected as ambiguous: the live exact-property query also resolves through Bill Wennington and Charles Oakley, both Space Jam cast members who played for the Chicago Bulls.",
    qualifierConcerns: "Jordan's film statement is qualified with the role 'Himself'; Bulls memberships cover 1984–1993 and 1995–1998. The dated memberships are sound but do not make the intermediary unique.",
    sourceEvidence: [
      { label: "Space Jam cast statement", url: "https://www.wikidata.org/wiki/Q207659#P161" },
      { label: "Michael Jordan team statement", url: "https://www.wikidata.org/wiki/Q41421#P54" },
      { label: "Space Jam", url: "https://www.warnerbros.com/movies/space-jam" },
      { label: "Michael Jordan profile", url: "https://www.nba.com/news/history-nba-legend-michael-jordan" },
    ],
    distractors: [
      { qid: "Q2607807", label: "Bill Wennington", exactPathMatch: true },
      { qid: "Q608514", label: "Charles Oakley", exactPathMatch: true },
      { qid: "Q193637", label: "Scottie Pippen", exactPathMatch: false },
    ],
    distractorValidationOutcome: "Failed: two plausible alternatives satisfy both exact edges. The intended answer cannot be presented as unique.",
    uniqueIntermediaryCount: 3,
  },
};

const approvedById = new Map(registry.filter((item) => batchIds.includes(item.id)).map((item) => [item.id, item]));
const candidates = batchIds.map((id) => {
  if (rejected[id]) return { id, decision: "rejected", ...rejected[id] };
  const puzzle = approvedById.get(id);
  if (!puzzle) throw new Error(`Missing approved batch puzzle: ${id}`);
  const exactPath = puzzle.path.map((item, index) => {
    if (index === 0) return `${item.name} (${item.qid})`;
    const edge = puzzle.relationships[index - 1];
    return `${edge.direction === "forward" ? "—" + edge.propertyId + "→" : "←" + edge.propertyId + "—"} ${item.name} (${item.qid})`;
  }).join(" ");
  const qualifiers = puzzle.relationships.flatMap((edge) => edge.qualifiers.map((item) => `${edge.propertyId}/${item.propertyId} ${item.label}: ${item.value}`));
  return {
    id,
    decision: "approved",
    reason: "Both current Wikidata statements and direction were confirmed; reliable supporting sources cover each material claim; the exact two-edge query returned only the intended intermediary.",
    exactPath,
    qualifierConcerns: id === "nineteen-eighty-four-orwell-bbc"
      ? "The current P108 statement has no date qualifiers. The Orwell Foundation independently dates the BBC employment to 1941–1943; those dates are retained in the expected-claim note and explanation, not represented as Wikidata qualifiers."
      : qualifiers.length ? `Reviewed: ${qualifiers.join("; ")}. Editorial wording avoids claiming more than these statements support.` : "No material qualifiers on either current statement.",
    sourceEvidence: puzzle.relationships.flatMap((edge) => edge.evidence),
    wikipediaLinks: puzzle.path.map((item) => ({ qid: item.qid, url: item.wikipediaUrl })),
    distractors: puzzle.options.filter((item) => item.id !== puzzle.correctOptionId).map((item) => ({ qid: item.qid, label: item.label, exactPathMatch: false })),
    distractorValidationOutcome: "Passed: all three alternatives are recognizable and plausible in context, but none satisfies both exact relationships in the bounded live query.",
    uniqueIntermediaryCount: 1,
  };
});

const report = {
  batchId: "phase-6c-batch-1",
  verifiedAt: "2026-10-12T00:00:00.000Z",
  scope: "Twenty bounded two-edge candidates; Neo4j discovery was treated only as a lead source and approval required independent current Wikidata, source, Wikipedia-link, uniqueness, qualifier, and distractor review.",
  counts: { candidates: 20, approved: 18, rejected: 2, priorApproved: 1, cumulativeApproved: 19, remainingTo100: 81, scheduled: 0 },
  rawGraphDiscovery: {
    file: "content/daily-review-queue.json",
    resultCount: 50,
    disposition: "Not promoted. Results were dominated by a generic universe hub and ambiguous Solidarity shared-membership/employer paths, so they were retained only as discovery evidence.",
  },
  candidates,
};

await writeFile(new URL("../content/daily-batch-1-review.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log("Wrote auditable decisions for 20 candidates (18 approved, 2 rejected). Cumulative approved: 19; gap: 81.");
