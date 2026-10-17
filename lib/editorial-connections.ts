import type {
  ConnectionNode,
  ConnectionPathData,
  ConnectionQualifier,
  ConnectionRelationship,
  DiscoveryResult,
  SelectedEntity,
} from "../components/connection-types.ts";
import { isValidQid } from "./wikidata-id.ts";
import {
  getConfiguredLaunchDate,
  getPuzzleScheduleWindow,
  getScheduledPuzzles,
  isPuzzleEditoriallyRevealed,
  type MissingLinkPuzzle,
} from "./daily-puzzles.ts";

export const EDITORIAL_SNAPSHOT_MAX_AGE_DAYS = 365;

export type EditorialReviewStatus = "approved" | "needs-review" | "rejected";
export type StatementDirection = "forward" | "reverse";
export type EditorialCategory =
  | "Business & technology"
  | "Entertainment & media"
  | "History"
  | "Places & culture"
  | "Science & innovation"
  | "Sports";

export type EditorialSource = {
  label: string;
  publisher: string;
  url: string;
};

export type ExpectedEditorialRelationship = {
  propertyId: string;
  subjectQid: string;
  objectQid: string;
  pathDirection: StatementDirection;
  qualifierPropertyIds?: readonly string[];
};

export type EditorialSnapshot = {
  version: 1;
  source: SelectedEntity;
  target: SelectedEntity;
  path: ConnectionPathData;
  headline?: string;
  introduction?: string;
  relationshipMeaning?: string;
  context?: readonly string[];
  verificationSources?: readonly EditorialSource[];
  editorialExplanation: string;
};

export type EditorialConnection = {
  slug: string;
  canonicalFromQid: string;
  canonicalToQid: string;
  category: EditorialCategory;
  pathFingerprint: string;
  expectedRelationships: readonly ExpectedEditorialRelationship[];
  reviewStatus: EditorialReviewStatus;
  verifiedAt: string;
  indexEligible: boolean;
  snapshot: EditorialSnapshot | null;
  relatedSlugs?: readonly string[];
  reviewNotes?: string;
};

export type SnapshotValidation =
  | { status: "ready"; connection: EditorialConnection; snapshot: EditorialSnapshot }
  | { status: "missing"; connection: EditorialConnection }
  | { status: "invalid"; connection: EditorialConnection; errors: string[] }
  | { status: "stale"; connection: EditorialConnection; staleSince: string };

export type EditorialPuzzleConflict = {
  puzzleId: string;
  schedulePosition: number;
  kinds: readonly ("direct-pair" | "hidden-entity" | "full-path" | "copy-mention")[];
  scheduledDate: string | null;
  editorialReleaseDate: string | null;
};

export type EditorialPublicationDecision =
  | {
      status: "public";
      validation: Extract<SnapshotValidation, { status: "ready" }>;
      conflicts: readonly EditorialPuzzleConflict[];
      grandfathered: boolean;
    }
  | {
      status: "held";
      reason: "not-approved" | "not-index-eligible" | "invalid-evidence" | "future-puzzle";
      validation: SnapshotValidation;
      conflicts: readonly EditorialPuzzleConflict[];
    };

// Owner-approved exceptions that remain public despite a known future-puzzle conflict.
export const LEGACY_PUBLIC_EDITORIAL_SLUGS = new Set([
  "steve-jobs-apple",
  "studio-ghibli-hayao-miyazaki",
  "michael-jordan-chicago-bulls",
  "google-larry-page",
]);

// Preserve the pre-guard public catalog if release timing is misconfigured.
// This does not let these pages bypass a known, configured future conflict.
const PREEXISTING_PUBLIC_EDITORIAL_SLUGS = new Set([
  "steve-jobs-apple",
  "walt-disney-the-walt-disney-company",
  "nasa-dwight-eisenhower",
  "studio-ghibli-hayao-miyazaki",
  "star-wars-george-lucas",
  "world-wide-web-tim-berners-lee",
  "apollo-11-neil-armstrong",
  "michael-jordan-chicago-bulls",
  "google-larry-page",
  "france-paris",
]);

function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`;
}

function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function node(
  qid: string,
  name: string,
  type: string,
  wikipediaTitle?: string,
): ConnectionNode {
  return {
    qid,
    name,
    type,
    wikidataUrl: wikidataUrl(qid),
    wikipediaUrl: wikipediaTitle ? wikipediaUrl(wikipediaTitle) : undefined,
    sourceLabel: wikipediaTitle ? "Wikipedia" : "Wikidata",
  };
}

function qualifier(
  propertyId: string,
  label: string,
  value: string,
): ConnectionQualifier {
  return {
    propertyId,
    label,
    value,
    sourceUrl: `https://www.wikidata.org/wiki/Property:${propertyId}`,
  };
}

function relationship(
  label: string,
  from: string,
  to: string,
  propertyId: string,
  statementDirection: StatementDirection,
  qualifiers: ConnectionQualifier[] = [],
): ConnectionRelationship {
  return {
    label,
    from,
    to,
    propertyId,
    propertyUrl: `https://www.wikidata.org/wiki/Property:${propertyId}`,
    statementDirection,
    qualifiers,
  };
}

function directSnapshot(input: {
  source: SelectedEntity;
  target: SelectedEntity;
  sourceNode: ConnectionNode;
  targetNode: ConnectionNode;
  relationship: ConnectionRelationship;
  headline?: string;
  introduction?: string;
  relationshipMeaning?: string;
  context?: readonly string[];
  verificationSources?: readonly EditorialSource[];
  editorialExplanation: string;
}): EditorialSnapshot {
  return {
    version: 1,
    source: input.source,
    target: input.target,
    path: {
      steps: 1,
      nodes: [input.sourceNode, input.targetNode],
      relationships: [input.relationship],
    },
    headline: input.headline,
    introduction: input.introduction,
    relationshipMeaning: input.relationshipMeaning,
    context: input.context,
    verificationSources: input.verificationSources,
    editorialExplanation: input.editorialExplanation,
  };
}

function entity(id: string, label: string, description: string): SelectedEntity {
  return { id, label, description };
}

export const EDITORIAL_CONNECTIONS: readonly EditorialConnection[] = [
  {
    slug: "steve-jobs-apple",
    canonicalFromQid: "Q19837",
    canonicalToQid: "Q312",
    category: "Business & technology",
    pathFingerprint: "hc-v1-553e20db",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q312",
        objectQid: "Q19837",
        pathDirection: "reverse",
        qualifierPropertyIds: ["P580"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["google-larry-page", "world-wide-web-tim-berners-lee", "walt-disney-the-walt-disney-company"],
    snapshot: directSnapshot({
      source: entity("Q19837", "Steve Jobs", "American entrepreneur and co-founder of Apple"),
      target: entity("Q312", "Apple Inc.", "American multinational technology company"),
      sourceNode: node("Q19837", "Steve Jobs", "person", "Steve Jobs"),
      targetNode: node("Q312", "Apple Inc.", "company/organization", "Apple Inc."),
      relationship: relationship(
        "co-founded",
        "Steve Jobs",
        "Apple Inc.",
        "P112",
        "reverse",
        [qualifier("P580", "start date", "1 April 1976")],
      ),
      headline: "Steve Jobs helped start Apple in a family garage.",
      introduction:
        "Before Apple became a global technology company, Steve Jobs and Steve Wozniak built its earliest chapter from Jobs’s parents’ garage. The reviewed path connects Jobs to the company he co-founded.",
      relationshipMeaning:
        "Wikidata stores Apple as the subject of property P112, “founded by,” with Steve Jobs as the object. Because this page reads from Jobs to Apple, the displayed phrase is the accurate reverse: “co-founded.”",
      context: [
        "The founder statement carries a start date of 1 April 1976.",
        "Jobs described starting Apple with Steve Wozniak when he was 20; this relationship does not imply he was Apple’s only founder.",
      ],
      verificationSources: [
        {
          label: "Steve Jobs’s 2005 Stanford commencement address",
          publisher: "Stanford University",
          url: "https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
        },
        {
          label: "Apple founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q312#P112",
        },
      ],
      editorialExplanation:
        "Apple Inc. identifies Steve Jobs as one of its founders, with the founding relationship dated 1 April 1976. The path is shown from Jobs to Apple, so it reads in the reverse direction of Wikidata property P112 (founded by).",
    }),
  },
  {
    slug: "walt-disney-the-walt-disney-company",
    canonicalFromQid: "Q8704",
    canonicalToQid: "Q7414",
    category: "Entertainment & media",
    pathFingerprint: "hc-v1-c8b4a8da",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q7414",
        objectQid: "Q8704",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["studio-ghibli-hayao-miyazaki", "star-wars-george-lucas", "steve-jobs-apple"],
    snapshot: directSnapshot({
      source: entity("Q8704", "Walt Disney", "American animator, producer, and entrepreneur"),
      target: entity("Q7414", "The Walt Disney Company", "American multinational mass media company"),
      sourceNode: node("Q8704", "Walt Disney", "person", "Walt Disney"),
      targetNode: node("Q7414", "The Walt Disney Company", "company/organization", "The Walt Disney Company"),
      relationship: relationship(
        "co-founded",
        "Walt Disney",
        "The Walt Disney Company",
        "P112",
        "reverse",
      ),
      headline: "Walt Disney co-founded the company that still bears his name.",
      introduction:
        "A short distribution contract for the Alice Comedies became the starting point for a century of Disney storytelling. This reviewed path connects Walt Disney to the company he established with his brother Roy.",
      relationshipMeaning:
        "The company’s Wikidata record uses P112, “founded by,” to point to Walt Disney. The page travels in the opposite direction, so the path correctly reads that Walt Disney “co-founded” The Walt Disney Company.",
      context: [
        "The Walt Disney Company dates its official beginning to 16 October 1923.",
        "Walt and Roy Disney began the Disney Brothers Cartoon Studio together; the relationship is not a claim of sole authorship or ownership.",
      ],
      verificationSources: [
        {
          label: "How a four-page contract started The Walt Disney Company",
          publisher: "The Walt Disney Company",
          url: "https://thewaltdisneycompany.com/news/disney100-anniversary-disney-contract/",
        },
        {
          label: "The Walt Disney Company founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q7414#P112",
        },
      ],
      editorialExplanation:
        "The Walt Disney Company identifies Walt Disney as a founder. The displayed route runs from Walt Disney to the company, which is the reverse reading of Wikidata property P112 (founded by).",
    }),
  },
  {
    slug: "george-lucas-lucasfilm",
    canonicalFromQid: "Q38222",
    canonicalToQid: "Q242446",
    category: "Entertainment & media",
    pathFingerprint: "hc-v1-b60a3367",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q242446",
        objectQid: "Q38222",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "The direct P112 claim is plausible but currently lacks a Wikidata reference. Obtain editorial source confirmation before indexing.",
    snapshot: directSnapshot({
      source: entity("Q38222", "George Lucas", "American filmmaker and philanthropist"),
      target: entity("Q242446", "Lucasfilm", "American film and television production company"),
      sourceNode: node("Q38222", "George Lucas", "person", "George Lucas"),
      targetNode: node("Q242446", "Lucasfilm", "company/organization", "Lucasfilm"),
      relationship: relationship(
        "founded",
        "George Lucas",
        "Lucasfilm",
        "P112",
        "reverse",
      ),
      editorialExplanation:
        "Lucasfilm identifies George Lucas as its founder. The route is displayed from Lucas to Lucasfilm, reversing Wikidata property P112 (founded by) into its natural-language inverse, founded.",
    }),
  },
  {
    slug: "nasa-dwight-eisenhower",
    canonicalFromQid: "Q23548",
    canonicalToQid: "Q9916",
    category: "History",
    pathFingerprint: "hc-v1-8b265cba",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q23548",
        objectQid: "Q9916",
        pathDirection: "forward",
        qualifierPropertyIds: ["P585", "P3831"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["apollo-11-neil-armstrong", "world-wide-web-tim-berners-lee", "france-paris"],
    snapshot: directSnapshot({
      source: entity("Q23548", "National Aeronautics and Space Administration", "American space and aeronautics agency"),
      target: entity("Q9916", "Dwight D. Eisenhower", "34th president of the United States"),
      sourceNode: node("Q23548", "National Aeronautics and Space Administration", "government/scientific organization", "NASA"),
      targetNode: node("Q9916", "Dwight D. Eisenhower", "person", "Dwight D. Eisenhower"),
      relationship: relationship(
        "founded by",
        "National Aeronautics and Space Administration",
        "Dwight D. Eisenhower",
        "P112",
        "forward",
        [
          qualifier("P585", "point in time", "29 July 1958"),
          qualifier("P3831", "object has role", "President of the United States"),
        ],
      ),
      headline: "NASA traces its founding to President Eisenhower’s signature.",
      introduction:
        "The agency that would lead the United States to the Moon began with legislation signed during the opening years of the Space Age. This path connects NASA to Dwight D. Eisenhower in his presidential role.",
      relationshipMeaning:
        "NASA’s Wikidata record uses P112, “founded by,” for Eisenhower. Its qualifiers make the claim specific: the statement is dated 29 July 1958 and identifies his role as President of the United States.",
      context: [
        "Eisenhower signed the National Aeronautics and Space Act into law on 29 July 1958.",
        "NASA began operations on 1 October 1958; the relationship describes the legal creation of the agency, not a claim that one person built it alone.",
      ],
      verificationSources: [
        {
          label: "President Eisenhower signs NASA into existence",
          publisher: "NASA",
          url: "https://www.nasa.gov/history/president-eisenhower-signs-nasa-into-existence/",
        },
        {
          label: "NASA founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q23548#P112",
        },
      ],
      editorialExplanation:
        "NASA identifies Dwight D. Eisenhower as a founder in his role as President of the United States, with the statement dated 29 July 1958, when he signed the National Aeronautics and Space Act.",
    }),
  },
  {
    slug: "heroes-iii-android",
    canonicalFromQid: "Q220965",
    canonicalToQid: "Q94",
    category: "Entertainment & media",
    pathFingerprint: "hc-v1-8e3cd2b9",
    expectedRelationships: [
      {
        propertyId: "P400",
        subjectQid: "Q220965",
        objectQid: "Q94",
        pathDirection: "forward",
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "Confirm the Android release context and an external source before indexing; the Wikidata P400 statement is currently unreferenced.",
    snapshot: directSnapshot({
      source: entity("Q220965", "Heroes of Might and Magic III: The Restoration of Erathia", "1999 strategy video game"),
      target: entity("Q94", "Android", "Mobile operating system"),
      sourceNode: node("Q220965", "Heroes of Might and Magic III: The Restoration of Erathia", "creative work", "Heroes of Might and Magic III"),
      targetNode: node("Q94", "Android", "product", "Android (operating system)"),
      relationship: relationship(
        "platform",
        "Heroes of Might and Magic III: The Restoration of Erathia",
        "Android",
        "P400",
        "forward",
      ),
      editorialExplanation:
        "Wikidata lists Android among the platforms for Heroes of Might and Magic III: The Restoration of Erathia. This describes platform availability, not the platform of the game's original 1999 release.",
    }),
  },
  {
    slug: "freebase-data-dumps-google",
    canonicalFromQid: "Q15241312",
    canonicalToQid: "Q95",
    category: "Business & technology",
    pathFingerprint: "hc-v1-7db1704e",
    expectedRelationships: [
      {
        propertyId: "P123",
        subjectQid: "Q15241312",
        objectQid: "Q95",
        pathDirection: "forward",
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "Confirm the publication relationship with an external source before indexing; the Wikidata P123 statement is currently unreferenced.",
    snapshot: directSnapshot({
      source: entity("Q15241312", "Freebase Data Dumps", "Dumps of the public part of Google's Knowledge Graph"),
      target: entity("Q95", "Google", "American multinational technology company"),
      sourceNode: node("Q15241312", "Freebase Data Dumps", "creative work"),
      targetNode: node("Q95", "Google", "company/organization", "Google"),
      relationship: relationship(
        "publisher",
        "Freebase Data Dumps",
        "Google",
        "P123",
        "forward",
      ),
      editorialExplanation:
        "Wikidata identifies Google as the publisher of the Freebase Data Dumps. This is a publication relationship between the released dataset and the organization that published it.",
    }),
  },
  {
    slug: "statue-of-liberty-france-historical-location",
    canonicalFromQid: "Q9202",
    canonicalToQid: "Q142",
    category: "Places & culture",
    pathFingerprint: "hc-v1-a50bd101",
    expectedRelationships: [
      {
        propertyId: "P276",
        subjectQid: "Q9202",
        objectQid: "Q142",
        pathDirection: "forward",
        qualifierPropertyIds: ["P582"],
      },
    ],
    reviewStatus: "needs-review",
    verifiedAt: "2026-10-10T00:00:00.000Z",
    indexEligible: false,
    reviewNotes:
      "Historically accurate only when the end-time qualifier is visible. Keep out of the index until editorial review confirms the wording and evidence.",
    snapshot: directSnapshot({
      source: entity("Q9202", "Statue of Liberty", "Monument in New York"),
      target: entity("Q142", "France", "Country in Western Europe and other continents"),
      sourceNode: node("Q9202", "Statue of Liberty", "monument/artifact", "Statue of Liberty"),
      targetNode: node("Q142", "France", "place", "France"),
      relationship: relationship(
        "historical location",
        "Statue of Liberty",
        "France",
        "P276",
        "forward",
        [qualifier("P582", "end time", "June 1885")],
      ),
      editorialExplanation:
        "Wikidata records France as a historical location of the Statue of Liberty only until June 1885, before the monument was shipped to the United States. France is not presented here as the monument's current location.",
    }),
  },
  {
    slug: "studio-ghibli-hayao-miyazaki",
    canonicalFromQid: "Q55400",
    canonicalToQid: "Q182950",
    category: "Entertainment & media",
    pathFingerprint: "hc-v1-7cc561ae",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q182950",
        objectQid: "Q55400",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["walt-disney-the-walt-disney-company", "star-wars-george-lucas"],
    snapshot: directSnapshot({
      source: entity("Q55400", "Hayao Miyazaki", "Japanese animator, filmmaker, and manga artist"),
      target: entity("Q182950", "Studio Ghibli", "Japanese animation studio"),
      sourceNode: node("Q55400", "Hayao Miyazaki", "person", "Hayao Miyazaki"),
      targetNode: node("Q182950", "Studio Ghibli", "company/organization", "Studio Ghibli"),
      relationship: relationship(
        "co-founded",
        "Hayao Miyazaki",
        "Studio Ghibli",
        "P112",
        "reverse",
      ),
      headline: "Hayao Miyazaki helped establish Studio Ghibli in 1985.",
      introduction:
        "Studio Ghibli grew out of the creative partnership behind Nausicaä of the Valley of the Wind. This reviewed path connects director Hayao Miyazaki to the animation studio he helped establish.",
      relationshipMeaning:
        "Studio Ghibli’s Wikidata record names Miyazaki through P112, “founded by.” Because the page starts with Miyazaki, the relationship is displayed in reverse as “co-founded.”",
      context: [
        "Studio Ghibli’s official history dates the studio’s opening to June 1985.",
        "The founder record also names Isao Takahata, Toshio Suzuki, and Yasuyoshi Tokuma, so this page does not present Miyazaki as the studio’s sole founder.",
      ],
      verificationSources: [
        {
          label: "Studio Ghibli history",
          publisher: "Studio Ghibli",
          url: "https://www.ghibli.jp/history/",
        },
        {
          label: "Studio Ghibli founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q182950#P112",
        },
      ],
      editorialExplanation:
        "Studio Ghibli identifies Hayao Miyazaki as one of its founders. The studio opened in June 1985 and was built around films directed by Miyazaki and Isao Takahata.",
    }),
  },
  {
    slug: "star-wars-george-lucas",
    canonicalFromQid: "Q462",
    canonicalToQid: "Q38222",
    category: "Entertainment & media",
    pathFingerprint: "hc-v1-42efc073",
    expectedRelationships: [
      {
        propertyId: "P170",
        subjectQid: "Q462",
        objectQid: "Q38222",
        pathDirection: "forward",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["walt-disney-the-walt-disney-company", "studio-ghibli-hayao-miyazaki"],
    snapshot: directSnapshot({
      source: entity("Q462", "Star Wars", "Science-fiction media franchise"),
      target: entity("Q38222", "George Lucas", "American filmmaker and entrepreneur"),
      sourceNode: node("Q462", "Star Wars", "creative work", "Star Wars"),
      targetNode: node("Q38222", "George Lucas", "person", "George Lucas"),
      relationship: relationship(
        "created by",
        "Star Wars",
        "George Lucas",
        "P170",
        "forward",
      ),
      headline: "Star Wars began with creator George Lucas.",
      introduction:
        "Long before Star Wars expanded across films, television, books, and games, it began as George Lucas’s imagined universe. This reviewed path records that creative origin without attributing every later story to him.",
      relationshipMeaning:
        "Wikidata uses P170, “creator,” from Star Wars to George Lucas. The edge describes authorship of the franchise’s originating concept, not sole authorship of every work released under the Star Wars name.",
      context: [
        "Lucasfilm’s official Star Wars site describes Lucas as the creator who opened the universe to later storytellers.",
        "The relationship is intentionally narrower than ownership, direction, or production of every Star Wars title.",
      ],
      verificationSources: [
        {
          label: "The Legendary Star Wars Expanded Universe Turns a New Page",
          publisher: "StarWars.com / Lucasfilm",
          url: "https://www.starwars.com/news/the-legendary-star-wars-expanded-universe-turns-a-new-page",
        },
        {
          label: "Star Wars creator statement (P170)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q462#P170",
        },
      ],
      editorialExplanation:
        "Wikidata identifies George Lucas as a creator of Star Wars, matching Lucasfilm’s description of him as the person who created the original universe and invited later storytellers into it.",
    }),
  },
  {
    slug: "world-wide-web-tim-berners-lee",
    canonicalFromQid: "Q466",
    canonicalToQid: "Q80",
    category: "Science & innovation",
    pathFingerprint: "hc-v1-6dbbd8fd",
    expectedRelationships: [
      {
        propertyId: "P61",
        subjectQid: "Q466",
        objectQid: "Q80",
        pathDirection: "forward",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["google-larry-page", "steve-jobs-apple", "apollo-11-neil-armstrong"],
    snapshot: directSnapshot({
      source: entity("Q466", "World Wide Web", "Global system of interlinked hypertext documents"),
      target: entity("Q80", "Tim Berners-Lee", "British computer scientist and inventor of the Web"),
      sourceNode: node("Q466", "World Wide Web", "technology", "World Wide Web"),
      targetNode: node("Q80", "Tim Berners-Lee", "person", "Tim Berners-Lee"),
      relationship: relationship(
        "invented by",
        "World Wide Web",
        "Tim Berners-Lee",
        "P61",
        "forward",
      ),
      headline: "The World Wide Web was invented by Tim Berners-Lee at CERN.",
      introduction:
        "The Web is not the Internet itself: it is the linked information system Tim Berners-Lee proposed while working at CERN. This path connects the system to one of the inventors named in its reviewed record.",
      relationshipMeaning:
        "Wikidata uses P61, “discoverer or inventor,” from the World Wide Web to Tim Berners-Lee. The same property also names Robert Cailliau, so the page does not erase the collaboration behind the Web’s early development.",
      context: [
        "Berners-Lee wrote his first Web proposal at CERN in March 1989.",
        "By the end of 1990 he had implemented key pieces including HTML, HTTP, URLs, the first server, and the first browser-editor.",
      ],
      verificationSources: [
        {
          label: "The birth of the Web",
          publisher: "CERN",
          url: "https://home.cern/science/computing/the-birth-of-the-web/",
        },
        {
          label: "World Wide Web inventor statement (P61)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q466#P61",
        },
      ],
      editorialExplanation:
        "The World Wide Web identifies Tim Berners-Lee as an inventor. He proposed the system at CERN in 1989 and implemented its foundational technologies in 1990.",
    }),
  },
  {
    slug: "apollo-11-neil-armstrong",
    canonicalFromQid: "Q43653",
    canonicalToQid: "Q1615",
    category: "Science & innovation",
    pathFingerprint: "hc-v1-89ee2628",
    expectedRelationships: [
      {
        propertyId: "P1029",
        subjectQid: "Q43653",
        objectQid: "Q1615",
        pathDirection: "forward",
        qualifierPropertyIds: ["P39"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["nasa-dwight-eisenhower", "world-wide-web-tim-berners-lee", "france-paris"],
    snapshot: directSnapshot({
      source: entity("Q43653", "Apollo 11", "1969 crewed lunar landing mission"),
      target: entity("Q1615", "Neil Armstrong", "American astronaut and Apollo 11 commander"),
      sourceNode: node("Q43653", "Apollo 11", "historic mission", "Apollo 11"),
      targetNode: node("Q1615", "Neil Armstrong", "person", "Neil Armstrong"),
      relationship: relationship(
        "crew member",
        "Apollo 11",
        "Neil Armstrong",
        "P1029",
        "forward",
        [qualifier("P39", "position held", "spacecraft commander")],
      ),
      headline: "Neil Armstrong commanded Apollo 11’s lunar mission.",
      introduction:
        "Apollo 11 carried three astronauts, each with a distinct job. This reviewed path connects the mission to Neil Armstrong and preserves the qualifier that identifies him as spacecraft commander.",
      relationshipMeaning:
        "Wikidata uses P1029, “crew member,” from Apollo 11 to Armstrong. The position-held qualifier matters: it specifies his command role rather than merely associating him with the mission.",
      context: [
        "Apollo 11 launched on 16 July 1969 and returned on 24 July.",
        "Armstrong commanded the mission and became the first human to step onto the Moon on 20 July 1969; Michael Collins and Buzz Aldrin were also crew members.",
      ],
      verificationSources: [
        {
          label: "Apollo 11 mission overview",
          publisher: "NASA",
          url: "https://www.nasa.gov/history/apollo-11-mission-overview/",
        },
        {
          label: "Apollo 11 crew statement (P1029)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q43653#P1029",
        },
      ],
      editorialExplanation:
        "Apollo 11 identifies Neil Armstrong as a crew member with the role of spacecraft commander. NASA records the mission from its 16 July 1969 launch through its 24 July return.",
    }),
  },
  {
    slug: "michael-jordan-chicago-bulls",
    canonicalFromQid: "Q41421",
    canonicalToQid: "Q128109",
    category: "Sports",
    pathFingerprint: "hc-v1-bb24457c",
    expectedRelationships: [
      {
        propertyId: "P54",
        subjectQid: "Q41421",
        objectQid: "Q128109",
        pathDirection: "forward",
        qualifierPropertyIds: ["P580", "P582"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["apollo-11-neil-armstrong", "steve-jobs-apple"],
    snapshot: directSnapshot({
      source: entity("Q41421", "Michael Jordan", "American basketball player"),
      target: entity("Q128109", "Chicago Bulls", "National Basketball Association team"),
      sourceNode: node("Q41421", "Michael Jordan", "athlete", "Michael Jordan"),
      targetNode: node("Q128109", "Chicago Bulls", "sports team", "Chicago Bulls"),
      relationship: relationship(
        "played for",
        "Michael Jordan",
        "Chicago Bulls",
        "P54",
        "forward",
        [
          qualifier("P580", "first stint began", "1984"),
          qualifier("P582", "first stint ended", "1993"),
          qualifier("P580", "second stint began", "1995"),
          qualifier("P582", "second stint ended", "1998"),
        ],
      ),
      headline: "Michael Jordan’s Bulls career came in two defining stints.",
      introduction:
        "Michael Jordan’s connection to Chicago is not a timeless membership label. The reviewed record preserves two separate playing periods, divided by his first retirement from basketball.",
      relationshipMeaning:
        "Wikidata uses P54, “member of sports team,” from Jordan to the Chicago Bulls. Two statements cover 1984–1993 and 1995–1998, so both date ranges are carried into the displayed edge.",
      context: [
        "Jordan’s first Bulls stint ran from 1984 through 1993; he returned in 1995 and played through 1998.",
        "The Bulls won six NBA championships during Jordan’s playing years: 1991–1993 and 1996–1998.",
      ],
      verificationSources: [
        {
          label: "Chicago Bulls franchise leaders and Hall of Fame players",
          publisher: "NBA / Chicago Bulls",
          url: "https://www.nba.com/team/1610612741/franchise-leaders",
        },
        {
          label: "Michael Jordan team-membership statements (P54)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q41421#P54",
        },
      ],
      editorialExplanation:
        "Michael Jordan’s Wikidata record links him to the Chicago Bulls in two playing stints, 1984–1993 and 1995–1998. Those periods include all six of the Bulls championships won during his career.",
    }),
  },
  {
    slug: "google-larry-page",
    canonicalFromQid: "Q4934",
    canonicalToQid: "Q95",
    category: "Business & technology",
    pathFingerprint: "hc-v1-f728a666",
    expectedRelationships: [
      {
        propertyId: "P112",
        subjectQid: "Q95",
        objectQid: "Q4934",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["steve-jobs-apple", "world-wide-web-tim-berners-lee"],
    snapshot: directSnapshot({
      source: entity("Q4934", "Larry Page", "American computer scientist and Internet entrepreneur"),
      target: entity("Q95", "Google", "American technology company"),
      sourceNode: node("Q4934", "Larry Page", "person", "Larry Page"),
      targetNode: node("Q95", "Google", "company/organization", "Google"),
      relationship: relationship(
        "co-founded",
        "Larry Page",
        "Google",
        "P112",
        "reverse",
      ),
      headline: "Larry Page co-founded Google after a Stanford research partnership.",
      introduction:
        "Google began as a search project built by Larry Page and Sergey Brin in Stanford dorm rooms. This reviewed path connects Page to the company that grew from that collaboration.",
      relationshipMeaning:
        "Google’s Wikidata record uses P112, “founded by,” for Larry Page. Since the page begins with Page, the relationship is displayed as the reverse phrase “co-founded.”",
      context: [
        "Page and Brin began working together in 1996 on the search engine first called Backrub.",
        "Google Inc. was formally established in 1998; the relationship does not present Page as the company’s only founder.",
      ],
      verificationSources: [
        {
          label: "How Google started",
          publisher: "Google",
          url: "https://about.google/company-info/our-story/",
        },
        {
          label: "Google founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q95#P112",
        },
      ],
      editorialExplanation:
        "Google identifies Larry Page as a founder alongside Sergey Brin. Their Stanford search project became Google, and Google Inc. was formally established in 1998.",
    }),
  },
  {
    slug: "france-paris",
    canonicalFromQid: "Q142",
    canonicalToQid: "Q90",
    category: "Places & culture",
    pathFingerprint: "hc-v1-93b09122",
    expectedRelationships: [
      {
        propertyId: "P36",
        subjectQid: "Q142",
        objectQid: "Q90",
        pathDirection: "forward",
        qualifierPropertyIds: ["P580"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-11T00:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["nasa-dwight-eisenhower", "apollo-11-neil-armstrong"],
    snapshot: directSnapshot({
      source: entity("Q142", "France", "Country in Western Europe and other continents"),
      target: entity("Q90", "Paris", "Capital and largest city of France"),
      sourceNode: node("Q142", "France", "country", "France"),
      targetNode: node("Q90", "Paris", "place", "Paris"),
      relationship: relationship(
        "capital",
        "France",
        "Paris",
        "P36",
        "forward",
        [qualifier("P580", "start date", "5 October 1789")],
      ),
      headline: "Paris is France’s capital, with a record shaped by history.",
      introduction:
        "Paris is France’s present capital and its best-known cultural center, but the underlying record also preserves changes in where French governments sat during earlier periods. This page shows the preferred current capital statement.",
      relationshipMeaning:
        "Wikidata uses P36, “capital,” from France to Paris. The preferred statement carries a start date of 5 October 1789; separate statements record earlier and wartime capitals rather than flattening them into the current relationship.",
      context: [
        "The displayed edge is the preferred current capital statement and includes its 5 October 1789 start qualifier.",
        "Other Wikidata statements preserve historical exceptions and predecessor capitals; this page does not claim that every French government sat continuously in Paris after that date.",
      ],
      verificationSources: [
        {
          label: "Paris, France’s capital",
          publisher: "Explore France / Atout France",
          url: "https://www.france.fr/en/article/paris-city-lights-1/",
        },
        {
          label: "France capital statement (P36)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q142#P36",
        },
      ],
      editorialExplanation:
        "France’s preferred Wikidata capital statement points to Paris and records a start date of 5 October 1789. Historical capital statements remain separate and are not presented as the current relationship.",
    }),
  },
  {
    slug: "tesla-spacex",
    canonicalFromQid: "Q478214",
    canonicalToQid: "Q193701",
    category: "Business & technology",
    pathFingerprint: "hc-v1-7cb73928",
    expectedRelationships: [
      {
        propertyId: "P169",
        subjectQid: "Q478214",
        objectQid: "Q317521",
        pathDirection: "forward",
      },
      {
        propertyId: "P169",
        subjectQid: "Q193701",
        objectQid: "Q317521",
        pathDirection: "reverse",
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-17T16:00:00.000Z",
    indexEligible: true,
    relatedSlugs: ["google-larry-page", "steve-jobs-apple", "nasa-dwight-eisenhower"],
    snapshot: {
      version: 1,
      source: entity("Q478214", "Tesla, Inc.", "American electric-vehicle and clean-energy company"),
      target: entity("Q193701", "SpaceX", "American spacecraft manufacturer and space-launch company"),
      path: {
        steps: 2,
        nodes: [
          node("Q478214", "Tesla, Inc.", "company/organization", "Tesla, Inc."),
          node("Q317521", "Elon Musk", "person", "Elon Musk"),
          node("Q193701", "SpaceX", "company/organization", "SpaceX"),
        ],
        relationships: [
          relationship(
            "chief executive officer",
            "Tesla, Inc.",
            "Elon Musk",
            "P169",
            "forward",
          ),
          relationship(
            "CEO of",
            "Elon Musk",
            "SpaceX",
            "P169",
            "reverse",
          ),
        ],
      },
      headline: "Elon Musk is the executive link between Tesla and SpaceX.",
      introduction:
        "Tesla and SpaceX are separate companies, but both identify Elon Musk as chief executive. That shared leadership is the durable two-step connection; the October 2026 Roadster demonstration is a recent example of technical collaboration, not evidence that one company owns the other.",
      relationshipMeaning:
        "Wikidata uses P169, \"chief executive officer,\" from Tesla to Elon Musk and from SpaceX to Musk. The second edge is displayed in reverse as \"CEO of.\" This path establishes shared executive leadership, not a parent-company, subsidiary, or ownership relationship between Tesla and SpaceX.",
      context: [
        "Tesla says Musk has served as its chief executive officer since October 2008 and as a director since April 2004.",
        "SpaceX identifies Musk as its founder and chief executive officer; Tesla's executive biography says he has served as SpaceX CEO, chief technology officer, and chair since May 2002.",
        "At Tesla's 15 October 2026 Roadster demonstration at SpaceX's Texas rocket-development site, Tesla said its prototype borrowed SpaceX technology for cold-gas thrusters. The demonstration supports a specific recent collaboration claim, not a general claim that the companies are the same business.",
        "The demonstrated vehicle was a prototype. Musk's 2028 production timing is a stated target, not evidence of a shipping product, and regulatory approval remains unresolved.",
      ],
      verificationSources: [
        {
          label: "Elon Musk executive biography",
          publisher: "Tesla Investor Relations",
          url: "https://ir.tesla.com/corporate/elon-musk",
        },
        {
          label: "SpaceX leadership",
          publisher: "SpaceX Investor Relations",
          url: "https://ir.spacex.com/leadership/",
        },
        {
          label: "Tesla chief executive officer statement (P169)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q478214#P169",
        },
        {
          label: "SpaceX chief executive officer statement (P169)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q193701#P169",
        },
        {
          label: "Roadster prototype demonstration at SpaceX",
          publisher: "Associated Press",
          url: "https://apnews.com/article/7d5f19665435b7408025bfb7a2f2f0b7",
        },
      ],
      editorialExplanation:
        "Tesla and SpaceX both identify Elon Musk as chief executive, creating a durable personnel connection between two otherwise separate companies. Tesla's October 2026 Roadster prototype demonstration at a SpaceX site supplied a timely example of technical collaboration, but prototype and production claims should not be confused with the verified executive path.",
    },
  },
] as const;

function normalizeQid(value: string): string {
  return value.trim().toUpperCase();
}

function pairKey(fromQid: string, toQid: string): string {
  return `${normalizeQid(fromQid)}:${normalizeQid(toQid)}`;
}

const CONNECTIONS_BY_CANONICAL_PAIR = new Map(
  EDITORIAL_CONNECTIONS.map((connection) => [
    pairKey(connection.canonicalFromQid, connection.canonicalToQid),
    connection,
  ]),
);

const CONNECTIONS_BY_REVERSED_PAIR = new Map(
  EDITORIAL_CONNECTIONS.map((connection) => [
    pairKey(connection.canonicalToQid, connection.canonicalFromQid),
    connection,
  ]),
);

const CONNECTIONS_BY_SLUG = new Map(
  EDITORIAL_CONNECTIONS.map((connection) => [connection.slug, connection]),
);

function safeUrl(value: string | undefined, hostname: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === hostname;
  } catch {
    return false;
  }
}

function safeHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function fingerprintInput(snapshot: EditorialSnapshot): string {
  return JSON.stringify({
    version: snapshot.version,
    source: snapshot.source.id,
    target: snapshot.target.id,
    nodes: snapshot.path.nodes.map((item) => item.qid),
    relationships: snapshot.path.relationships.map((item) => ({
      propertyId: item.propertyId,
      from: item.from,
      to: item.to,
      statementDirection: item.statementDirection,
      qualifiers: item.qualifiers?.map((item) => ({
        propertyId: item.propertyId,
        value: item.value,
      })) ?? [],
    })),
  });
}

export function createEditorialPathFingerprint(snapshot: EditorialSnapshot): string {
  let hash = 2166136261;
  for (const character of fingerprintInput(snapshot)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `hc-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function findEditorialConnection(
  fromQid: string,
  toQid: string,
): EditorialConnection | null {
  return CONNECTIONS_BY_CANONICAL_PAIR.get(pairKey(fromQid, toQid)) ?? null;
}

export function findReversedEditorialConnection(
  fromQid: string,
  toQid: string,
): EditorialConnection | null {
  return CONNECTIONS_BY_REVERSED_PAIR.get(pairKey(fromQid, toQid)) ?? null;
}

export function findEditorialConnectionBySlug(
  slug: string,
): EditorialConnection | null {
  return CONNECTIONS_BY_SLUG.get(slug) ?? null;
}

export function validateEditorialSnapshot(
  connection: EditorialConnection,
  now = new Date(),
): SnapshotValidation {
  const snapshot = connection.snapshot;
  if (!snapshot) return { status: "missing", connection };

  const errors: string[] = [];
  if (snapshot.source.id !== connection.canonicalFromQid) {
    errors.push("Snapshot source does not match the canonical source QID.");
  }
  if (snapshot.target.id !== connection.canonicalToQid) {
    errors.push("Snapshot target does not match the canonical target QID.");
  }
  if (snapshot.path.steps !== snapshot.path.relationships.length) {
    errors.push("Snapshot step count does not match its relationship count.");
  }
  if (snapshot.path.nodes.length !== snapshot.path.relationships.length + 1) {
    errors.push("Snapshot node and relationship counts do not form a path.");
  }
  if (
    snapshot.path.nodes.some(
      (item) => !item.qid || !isValidQid(item.qid) || !safeUrl(item.wikidataUrl, "www.wikidata.org"),
    )
  ) {
    errors.push("Every snapshot node must have a valid QID and Wikidata evidence URL.");
  }
  if (
    snapshot.path.nodes.some(
      (item) => item.wikipediaUrl && !safeUrl(item.wikipediaUrl, "en.wikipedia.org"),
    )
  ) {
    errors.push("Snapshot Wikipedia evidence URLs must use English Wikipedia over HTTPS.");
  }
  if (snapshot.path.relationships.length !== connection.expectedRelationships.length) {
    errors.push("Snapshot relationships do not match the expected relationship count.");
  }

  connection.expectedRelationships.forEach((expected, index) => {
    const actual = snapshot.path.relationships[index];
    if (!actual) return;
    if (actual.propertyId !== expected.propertyId) {
      errors.push(`Relationship ${index + 1} has an unexpected property ID.`);
    }
    if (actual.statementDirection !== expected.pathDirection) {
      errors.push(`Relationship ${index + 1} has an unexpected statement direction.`);
    }
    if (!safeUrl(actual.propertyUrl, "www.wikidata.org")) {
      errors.push(`Relationship ${index + 1} is missing a Wikidata property URL.`);
    }
    const actualFrom = snapshot.path.nodes[index]?.qid;
    const actualTo = snapshot.path.nodes[index + 1]?.qid;
    const statementSubject = expected.pathDirection === "forward" ? actualFrom : actualTo;
    const statementObject = expected.pathDirection === "forward" ? actualTo : actualFrom;
    if (statementSubject !== expected.subjectQid || statementObject !== expected.objectQid) {
      errors.push(`Relationship ${index + 1} has unexpected statement endpoints.`);
    }
    const actualQualifierIds = new Set(
      actual.qualifiers?.map((item) => item.propertyId) ?? [],
    );
    for (const propertyId of expected.qualifierPropertyIds ?? []) {
      if (!actualQualifierIds.has(propertyId)) {
        errors.push(`Relationship ${index + 1} is missing qualifier ${propertyId}.`);
      }
    }
    if (
      actual.qualifiers?.some(
        (item) =>
          !/^P[1-9]\d*$/.test(item.propertyId) ||
          !item.label.trim() ||
          !item.value.trim() ||
          !safeUrl(item.sourceUrl, "www.wikidata.org"),
      )
    ) {
      errors.push(`Relationship ${index + 1} has an invalid qualifier.`);
    }
  });

  if (createEditorialPathFingerprint(snapshot) !== connection.pathFingerprint) {
    errors.push("Snapshot fingerprint does not match the reviewed fingerprint.");
  }
  if (!snapshot.editorialExplanation.trim()) {
    errors.push("Snapshot is missing an editorial explanation.");
  }
  if (connection.reviewStatus === "approved" && connection.indexEligible) {
    if (!snapshot.headline?.trim()) errors.push("Approved snapshot is missing a headline.");
    if (!snapshot.introduction?.trim()) {
      errors.push("Approved snapshot is missing an introduction.");
    }
    if (!snapshot.relationshipMeaning?.trim()) {
      errors.push("Approved snapshot is missing a relationship explanation.");
    }
    if (!snapshot.context?.length || snapshot.context.some((item) => !item.trim())) {
      errors.push("Approved snapshot is missing reviewed historical context.");
    }
    if (
      !snapshot.verificationSources?.length ||
      snapshot.verificationSources.some(
        (source) =>
          !source.label.trim() ||
          !source.publisher.trim() ||
          !safeHttpsUrl(source.url),
      )
    ) {
      errors.push("Approved snapshot has invalid verification sources.");
    }
    const relatedSlugs = connection.relatedSlugs ?? [];
    if (
      new Set(relatedSlugs).size !== relatedSlugs.length ||
      relatedSlugs.includes(connection.slug) ||
      relatedSlugs.some((slug) => {
        const related = CONNECTIONS_BY_SLUG.get(slug);
        return !related || related.reviewStatus !== "approved" || !related.indexEligible;
      })
    ) {
      errors.push("Approved snapshot has invalid related connections.");
    }
  }

  const verifiedAt = new Date(connection.verifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) {
    errors.push("Verification timestamp is invalid.");
  }
  if (errors.length > 0) return { status: "invalid", connection, errors };

  const staleAt = new Date(
    verifiedAt.getTime() + EDITORIAL_SNAPSHOT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  if (now.getTime() > staleAt.getTime()) {
    return { status: "stale", connection, staleSince: staleAt.toISOString() };
  }

  return { status: "ready", connection, snapshot };
}

function normalizedDisclosureText(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Invalid URL escapes remain searchable as their literal text.
  }
  return decoded
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unorderedQidPair(left: string, right: string): string {
  return [left.toUpperCase(), right.toUpperCase()].sort().join(":");
}

function editorialCopy(snapshot: EditorialSnapshot): string {
  return normalizedDisclosureText([
    snapshot.headline,
    snapshot.introduction,
    snapshot.relationshipMeaning,
    snapshot.editorialExplanation,
    ...(snapshot.context ?? []),
    ...(snapshot.verificationSources ?? []).flatMap(({ label, publisher, url }) => [label, publisher, url]),
  ].filter(Boolean).join(" "));
}

function disclosureConflictKindsForPuzzle(
  puzzle: MissingLinkPuzzle,
  qids: ReadonlySet<string>,
  disclosureText: string,
): EditorialPuzzleConflict["kinds"] {
  const kinds = new Set<EditorialPuzzleConflict["kinds"][number]>();
  const hiddenNode = puzzle.path[puzzle.hiddenNodeIndex];
  if (!hiddenNode) return [];
  if (qids.has(hiddenNode.qid.toUpperCase())) kinds.add("hidden-entity");

  const normalizedText = normalizedDisclosureText(disclosureText);
  const hiddenLabel = normalizedDisclosureText(hiddenNode.name);
  const hiddenQid = normalizedDisclosureText(hiddenNode.qid);
  if (
    (hiddenLabel.length >= 4 && (` ${normalizedText} `).includes(` ${hiddenLabel} `)) ||
    (` ${normalizedText} `).includes(` ${hiddenQid} `)
  ) {
    kinds.add("copy-mention");
  }
  return [...kinds];
}

export function getUnrevealedPuzzleDisclosureConflicts(
  input: {
    qids?: readonly string[];
    text: readonly string[];
  },
  options: { now?: Date; launchDate?: string | null } = {},
): EditorialPuzzleConflict[] {
  const launchDate = options.launchDate === undefined
    ? getConfiguredLaunchDate()
    : options.launchDate;
  const qids = new Set((input.qids ?? []).map((qid) => qid.toUpperCase()));
  const disclosureText = input.text.filter(Boolean).join(" ");

  return getScheduledPuzzles().flatMap((puzzle) => {
    if (isPuzzleEditoriallyRevealed(puzzle, options.now, launchDate)) return [];
    const kinds = disclosureConflictKindsForPuzzle(puzzle, qids, disclosureText);
    if (kinds.length === 0) return [];
    const window = getPuzzleScheduleWindow(puzzle, launchDate);
    return [{
      puzzleId: puzzle.id,
      schedulePosition: puzzle.schedulePosition ?? 0,
      kinds,
      scheduledDate: window?.scheduledDate ?? null,
      editorialReleaseDate: window?.editorialReleaseDate ?? null,
    }];
  });
}

function puzzleConflictKinds(
  connection: EditorialConnection,
  puzzle: MissingLinkPuzzle,
): EditorialPuzzleConflict["kinds"] {
  const snapshot = connection.snapshot;
  if (!snapshot) return [];
  const kinds = new Set<EditorialPuzzleConflict["kinds"][number]>();
  const editorialNodeQids = new Set(
    snapshot.path.nodes.flatMap(({ qid }) => qid ? [qid.toUpperCase()] : []),
  );
  for (const kind of disclosureConflictKindsForPuzzle(
    puzzle,
    editorialNodeQids,
    editorialCopy(snapshot),
  )) {
    kinds.add(kind);
  }

  const editorialPair = unorderedQidPair(
    connection.canonicalFromQid,
    connection.canonicalToQid,
  );
  for (let index = 0; index < puzzle.path.length - 1; index += 1) {
    if (unorderedQidPair(puzzle.path[index].qid, puzzle.path[index + 1].qid) === editorialPair) {
      kinds.add("direct-pair");
    }
  }

  const editorialPath = snapshot.path.nodes.map(({ qid }) => qid).join(">");
  const puzzlePath = puzzle.path.map(({ qid }) => qid).join(">");
  const reversedPuzzlePath = [...puzzle.path].reverse().map(({ qid }) => qid).join(">");
  if (editorialPath === puzzlePath || editorialPath === reversedPuzzlePath) {
    kinds.add("full-path");
  }

  return [...kinds];
}

export function getEditorialPuzzleConflicts(
  connection: EditorialConnection,
  options: { now?: Date; launchDate?: string | null } = {},
): EditorialPuzzleConflict[] {
  const launchDate = options.launchDate === undefined
    ? getConfiguredLaunchDate()
    : options.launchDate;
  return getScheduledPuzzles().flatMap((puzzle) => {
    const kinds = puzzleConflictKinds(connection, puzzle);
    if (kinds.length === 0 || isPuzzleEditoriallyRevealed(puzzle, options.now, launchDate)) {
      return [];
    }
    const window = getPuzzleScheduleWindow(puzzle, launchDate);
    return [{
      puzzleId: puzzle.id,
      schedulePosition: puzzle.schedulePosition ?? 0,
      kinds,
      scheduledDate: window?.scheduledDate ?? null,
      editorialReleaseDate: window?.editorialReleaseDate ?? null,
    }];
  });
}

export function getEditorialPublicationDecision(
  connection: EditorialConnection,
  options: { now?: Date; launchDate?: string | null } = {},
): EditorialPublicationDecision {
  const launchDate = options.launchDate === undefined
    ? getConfiguredLaunchDate()
    : options.launchDate;
  const validation = validateEditorialSnapshot(connection, options.now);
  const conflicts = getEditorialPuzzleConflicts(connection, { ...options, launchDate });
  if (connection.reviewStatus !== "approved") {
    return { status: "held", reason: "not-approved", validation, conflicts };
  }
  if (!connection.indexEligible) {
    return { status: "held", reason: "not-index-eligible", validation, conflicts };
  }
  if (validation.status !== "ready") {
    return { status: "held", reason: "invalid-evidence", validation, conflicts };
  }
  const grandfathered = LEGACY_PUBLIC_EDITORIAL_SLUGS.has(connection.slug);
  const preservePreexistingWithoutSchedule =
    !launchDate && PREEXISTING_PUBLIC_EDITORIAL_SLUGS.has(connection.slug);
  if (conflicts.length > 0 && !grandfathered && !preservePreexistingWithoutSchedule) {
    return { status: "held", reason: "future-puzzle", validation, conflicts };
  }
  return { status: "public", validation, conflicts, grandfathered };
}

export function getIndexableEditorialConnections(
  now = new Date(),
): EditorialConnection[] {
  return EDITORIAL_CONNECTIONS.filter(
    (connection) => getEditorialPublicationDecision(connection, { now }).status === "public",
  );
}

export function getRelatedEditorialConnections(
  connection: EditorialConnection,
  now = new Date(),
): EditorialConnection[] {
  return (connection.relatedSlugs ?? []).flatMap((slug) => {
    const related = CONNECTIONS_BY_SLUG.get(slug);
    return related &&
      getEditorialPublicationDecision(related, { now }).status === "public"
      ? [related]
      : [];
  });
}

export function snapshotToDiscoveryResult(snapshot: EditorialSnapshot): DiscoveryResult {
  return {
    found: true,
    timedOut: false,
    bestPath: snapshot.path,
    alternatePaths: [],
  };
}
