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

export type EditorialEvidenceRole =
  | "structured-claim"
  | "primary-source"
  | "independent-corroboration"
  | "context-source";

export type EditorialFreshness =
  | "historical"
  | "periodic"
  | "current-role"
  | "time-sensitive";

const EDITORIAL_EVIDENCE_ROLES = new Set<EditorialEvidenceRole>([
  "structured-claim",
  "primary-source",
  "independent-corroboration",
  "context-source",
]);

const EDITORIAL_FRESHNESS_CLASSES = new Set<EditorialFreshness>([
  "historical",
  "periodic",
  "current-role",
  "time-sensitive",
]);

export type EditorialSource = {
  label: string;
  publisher: string;
  url: string;
  evidenceRole?: EditorialEvidenceRole;
  supports?: readonly string[];
  reviewedAt?: string;
  freshness?: EditorialFreshness;
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
  limitations?: readonly string[];
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
  limitations?: readonly string[];
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
    limitations: input.limitations,
    verificationSources: input.verificationSources,
    editorialExplanation: input.editorialExplanation,
  };
}

function entity(id: string, label: string, description: string): SelectedEntity {
  return { id, label, description };
}

const PHASE_10B_REVIEWED_AT = "2026-10-27T23:30:00.000Z";

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
    verifiedAt: PHASE_10B_REVIEWED_AT,
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
      headline: "Steve Jobs co-founded Apple—but the garage is only part of the origin story.",
      introduction:
        "Apple’s Los Altos garage became a powerful symbol of startup culture, but Apple did not emerge from one person or one room. Steve Jobs connected an engineering project by Steve Wozniak to a business opportunity, and the partnership they formed with Ronald Wayne became Apple Computer Company.",
      relationshipMeaning:
        "Wikidata stores Apple as the subject of property P112, “founded by,” with Steve Jobs as one founder object. Because this page reads from Jobs to Apple, the displayed phrase is the accurate reverse: “co-founded.” The 1 April 1976 qualifier belongs to that structured founder statement.",
      context: [
        "On 1 April 1976, Jobs, Wozniak, and Ronald Wayne formed Apple Computer Company as a partnership. Wayne’s brief participation is easy to lose when the story is reduced to the better-known pair.",
        "Wozniak designed the Apple I and demonstrated his computer work in the Homebrew Computer Club community; Jobs helped turn that work into a product and a company. Founder credit is not the same as sole technical authorship.",
        "Jobs later recalled that he and Wozniak started Apple in his parents’ garage. Institutional histories also place early Apple I work there, but the company’s origin is better understood as a sequence of design, demonstration, partnership, assembly, and sales—not a single eureka moment in one room.",
        "The reviewed graph date identifies the partnership’s beginning. Apple Computer, Inc. was incorporated later, so the qualifier should not be read as the date every later Apple legal entity or product came into existence.",
      ],
      limitations: [
        "This is a co-founder relationship. It does not describe Jobs as Apple’s only founder, the sole designer of the Apple I, or the author of Apple’s later products.",
        "The garage is a documented early workplace and an enduring symbol, not a complete explanation of Apple’s formation or a claim that every founding act happened there.",
      ],
      verificationSources: [
        {
          label: "Steve Jobs’s 2005 Stanford commencement address",
          publisher: "Stanford University",
          url: "https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
          evidenceRole: "primary-source",
          supports: [
            "Jobs’s own retrospective account that he and Steve Wozniak started Apple in his parents’ garage.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Apple timeline",
          publisher: "Computer History Museum",
          url: "https://computerhistory.org/apple-timeline/",
          evidenceRole: "independent-corroboration",
          supports: [
            "The 1976 partnership among Steve Jobs, Steve Wozniak, and Ronald Wayne and the distinction between Apple’s founding partnership and its later incorporation.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Steve Wozniak profile",
          publisher: "Computer History Museum",
          url: "https://computerhistory.org/profile/steve-wozniak/",
          evidenceRole: "context-source",
          supports: [
            "Wozniak’s engineering of the early Apple computers and the Homebrew Computer Club context behind the product that became Apple’s first business.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Apple founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q312#P112",
          evidenceRole: "structured-claim",
          supports: [
            "The P112 founder edge from Apple to Steve Jobs and its 1 April 1976 start qualifier.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Steve Jobs is connected to Apple as one of its co-founders, with the graph statement dated to the partnership formed on 1 April 1976. The educational value lies beyond that edge: Wozniak’s engineering, Jobs’s business role, Wayne’s short-lived third-founder role, and the garage as a real setting that later became a simplified creation myth all belong to the same origin story.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
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
      headline: "An Alice Comedies contract launched the studio Walt and Roy Disney built together.",
      introduction:
        "The company now associated with Mickey Mouse began before Mickey, with a live-action girl moving through an animated world. A distribution agreement for the Alice Comedies gave Walt Disney a viable production series, while Roy Disney supplied the business partnership that turned the opportunity into a studio.",
      relationshipMeaning:
        "The company’s Wikidata record uses P112, “founded by,” to point to Walt Disney. The page travels in the opposite direction, so the path correctly reads that Walt Disney “co-founded” The Walt Disney Company. That compact edge connects a person to today’s company; the sources explain the earlier Disney Brothers Cartoon Studio and the business events behind it.",
      context: [
        "Walt arrived in Los Angeles after his Kansas City business, Laugh-O-gram Films, failed. He carried Alice’s Wonderland, a pilot mixing a live-action child with animation, and used it to seek a distributor for a series.",
        "On 16 October 1923, distributor Margaret J. Winkler contracted for the Alice Comedies. Disney treats that agreement as the company’s official beginning because it supplied the work around which the new studio could operate.",
        "Walt and Roy formed the Disney Brothers Cartoon Studio as partners. Walt led the creative work; Roy brought financial and business management. Calling only Walt a founder hides the division of labor that made the studio sustainable.",
        "The first working studio occupied space behind a Los Angeles real-estate office before moving into the neighboring storefront. The modern company name and corporate scale came later, so the graph edge is a line of continuity rather than proof that the 1923 business already had its present form.",
      ],
      limitations: [
        "The edge identifies Walt Disney as a co-founder; it does not erase Roy Disney’s equal early partnership, Margaret Winkler’s enabling distribution role, or the work of the studio’s artists.",
        "The 16 October 1923 date is the company’s chosen institutional starting point. Creative work on Alice’s Wonderland preceded it, and the business changed names and legal forms afterward.",
      ],
      verificationSources: [
        {
          label: "How a four-page contract started The Walt Disney Company",
          publisher: "The Walt Disney Company",
          url: "https://thewaltdisneycompany.com/news/disney100-anniversary-disney-contract/",
          evidenceRole: "primary-source",
          supports: [
            "The company’s account of the 16 October 1923 contract and the brothers’ early studio.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Walt Disney, Up Close",
          publisher: "PBS American Experience",
          url: "https://www.pbs.org/wgbh/americanexperience/features/walt-disney-close/",
          evidenceRole: "independent-corroboration",
          supports: [
            "The failure of Laugh-O-gram, Walt’s move to Los Angeles, the Winkler offer for Alice shorts, and Roy’s financial and business role in the two-person studio.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Disney Brothers Studio historic-cultural monument report",
          publisher: "City of Los Angeles",
          url: "https://planning.lacity.gov/plndoc/Staff_Reports/2024/06-20-2024/Item_05_CHC_2024_2508_HCM_Disney_Brothers_Studio_Final.pdf",
          evidenceRole: "context-source",
          supports: [
            "The studio’s first rented real-estate-office workspace, its early storefront move, and the role of the Alice Comedies in the brothers’ first commercial growth.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "The Walt Disney Company founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q7414#P112",
          evidenceRole: "structured-claim",
          supports: [
            "The P112 founder edge from The Walt Disney Company to Walt Disney.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Walt Disney’s founder edge is accurate but incomplete on its own. The business began when an Alice Comedies distribution contract gave Walt’s animation concept a market and Walt and Roy organized the Disney Brothers Cartoon Studio around it; the present company descends from that partnership rather than from a single founder or from Mickey Mouse’s later debut.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
    indexEligible: true,
    relatedSlugs: ["apollo-11-neil-armstrong", "tesla-spacex", "world-wide-web-tim-berners-lee"],
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
      headline: "Eisenhower signed NASA into law, but the agency grew from Congress, NACA, and a civilian-space policy.",
      introduction:
        "NASA’s legal birth can be dated to President Dwight D. Eisenhower’s signature, but the agency was not created by one person acting alone. Congress wrote and passed the governing statute, the older National Advisory Committee for Aeronautics supplied its institutional core, and the new agency embodied a deliberate choice to place non-military space research in civilian hands.",
      relationshipMeaning:
        "NASA’s Wikidata record uses P112, “founded by,” for Eisenhower. Its qualifiers make the graph claim specific: 29 July 1958, with Eisenhower acting as President of the United States. The sources narrow the natural-language meaning of “founded” to his constitutional role in signing the National Aeronautics and Space Act.",
      context: [
        "Sputnik’s launch in October 1957 intensified pressure for a coordinated American space program, but the response involved hearings, scientific advice, executive proposals, and bipartisan legislation—not just a presidential announcement.",
        "Eisenhower signed Public Law 85-568, the National Aeronautics and Space Act, on 29 July 1958. The statute established NASA and set objectives that included scientific knowledge, aeronautics, space vehicles, and peaceful uses of space.",
        "NASA opened on 1 October 1958. On that date NACA was dissolved and its people, laboratories, and decades of aeronautical research became the core of the new agency.",
        "The civilian design mattered: National Archives material records Eisenhower’s preference for a civilian agency rather than placing the national space program primarily under the Department of Defense.",
      ],
      limitations: [
        "“Founded by” is a compact graph label for Eisenhower’s presidential role in NASA’s legal creation. It is not a claim that he alone drafted the law, designed the agency, or performed the research that NASA inherited.",
        "NASA’s creation did not erase military space activity. The relationship concerns the civilian agency established by statute, not every United States space program operating in 1958.",
      ],
      verificationSources: [
        {
          label: "President Eisenhower signs NASA into existence",
          publisher: "NASA",
          url: "https://www.nasa.gov/history/president-eisenhower-signs-nasa-into-existence/",
          evidenceRole: "primary-source",
          supports: [
            "Eisenhower’s 29 July 1958 signing of the National Aeronautics and Space Act and NASA’s 1 October 1958 operational start.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Celebrating NASA’s 60th anniversary",
          publisher: "U.S. National Archives",
          url: "https://prologue.blogs.archives.gov/2018/10/01/celebrating-nasas-60th-anniversary/",
          evidenceRole: "independent-corroboration",
          supports: [
            "NASA’s replacement of NACA, the Cold War context, and Eisenhower’s preference for a civilian rather than predominantly military agency.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "National Aeronautics and Space Act of 1958",
          publisher: "United States Congress",
          url: "https://www.congress.gov/85/statute/STATUTE-72/STATUTE-72-Pg426-2.pdf",
          evidenceRole: "primary-source",
          supports: [
            "The statutory creation of NASA and the law’s scientific, aeronautical, and peaceful-use objectives.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "NASA founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q23548#P112",
          evidenceRole: "structured-claim",
          supports: [
            "The P112 edge to Eisenhower and the point-in-time and presidential-role qualifiers displayed on this page.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "NASA’s direct graph connection to Eisenhower records a precise legal act: as president, he signed the National Aeronautics and Space Act on 29 July 1958. The fuller history replaces the heroic-founder shorthand with an institutional one—Congressional lawmaking, a civilian-policy choice, and the transfer of NACA’s people and research into an agency that began operating on 1 October.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
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
      headline: "Miyazaki co-founded Studio Ghibli after Nausicaä proved a new feature-animation studio could work.",
      introduction:
        "Studio Ghibli did not exist when Nausicaä of the Valley of the Wind reached cinemas in 1984. The film’s artistic and commercial success helped convince Hayao Miyazaki, Isao Takahata, producer Toshio Suzuki, and publisher Yasuyoshi Tokuma that their collaboration could support a studio devoted to ambitious theatrical animation.",
      relationshipMeaning:
        "Studio Ghibli’s Wikidata record names Miyazaki through P112, “founded by.” Because the page starts with Miyazaki, the relationship is displayed in reverse as “co-founded.” The same structured record names other founders, while institutional sources describe both the creative partnership and Tokuma Shoten’s organizational role.",
      context: [
        "Nausicaä was released in 1984, before Studio Ghibli opened. It is commonly grouped with Ghibli’s films because the same creative team led into the studio, but it was not produced by the yet-unformed company.",
        "Ghibli’s official history says Tokuma Shoten established the studio in 1985 after Nausicaä succeeded, initially to make theatrical features by Miyazaki and Takahata. Its chronology records the studio opening in June in Kichijōji, Tokyo.",
        "Independent film institutions describe Miyazaki, Takahata, Suzuki, and Tokuma as the founding group. The differing emphasis—directors, producer, or publisher—explains why a single founder edge needs context rather than a single-hero narrative.",
        "Castle in the Sky, released in 1986, was the first feature produced under the Studio Ghibli name. That makes it a clearer corporate starting point than retroactively labeling Nausicaä a Ghibli production.",
      ],
      limitations: [
        "This page identifies Miyazaki as one of Studio Ghibli’s founders. It does not treat the studio as his sole creation or reduce Takahata, Suzuki, Tokuma, and Tokuma Shoten to supporting footnotes.",
        "Nausicaä is essential prehistory, not a film originally produced by Studio Ghibli. Grouping it with the later catalog should not move the company’s founding date backward.",
      ],
      verificationSources: [
        {
          label: "Studio Ghibli history",
          publisher: "Studio Ghibli",
          url: "https://www.ghibli.jp/history/",
          evidenceRole: "primary-source",
          supports: [
            "The studio’s account that Nausicaä’s success led Tokuma Shoten to establish Studio Ghibli in 1985 for features by Miyazaki and Takahata.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Studio Ghibli chronology",
          publisher: "Studio Ghibli",
          url: "https://www.ghibli.jp/chronology/",
          evidenceRole: "primary-source",
          supports: [
            "The studio’s June 1985 opening in Kichijōji and Castle in the Sky’s 1986 release as the first post-founding feature in its chronology.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Where to begin with Studio Ghibli",
          publisher: "British Film Institute",
          url: "https://www.bfi.org.uk/features/where-begin-with-studio-ghibli",
          evidenceRole: "independent-corroboration",
          supports: [
            "The 1985 founding group and the studio’s formation after the collaborators’ work on the Nausicaä manga and film adaptation.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Hayao Miyazaki collection profile",
          publisher: "Academy of Motion Picture Arts and Sciences",
          url: "https://www.oscars.org/collection-highlights/hayao-miyazaki",
          evidenceRole: "context-source",
          supports: [
            "Miyazaki’s co-founder status and the distinction between pre-Ghibli Nausicaä and the features he directed after the studio formed.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Studio Ghibli founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q182950#P112",
          evidenceRole: "structured-claim",
          supports: [
            "The P112 founder edge from Studio Ghibli to Hayao Miyazaki and the presence of additional founders.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Hayao Miyazaki’s founder edge is best understood as one strand in a four-person and publisher-backed collaboration. Nausicaä demonstrated the creative and commercial possibility; Studio Ghibli opened in June 1985 to build a durable home for feature animation; and Castle in the Sky became the first feature actually produced under the new studio’s name.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
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
      headline: "George Lucas created Star Wars, but the franchise was built through revision and collaboration.",
      introduction:
        "Star Wars now spans many creators and media, but its originating story world can be traced to George Lucas’s early-1970s notes, treatments, and screenplay drafts. The path records that creative origin while the evidence shows how an evolving film project became a franchise larger than any one author.",
      relationshipMeaning:
        "Wikidata uses P170, “creator,” from the Star Wars franchise to George Lucas. The edge describes authorship of the originating concept and story world; it is not a writer, director, or producer credit for every film, series, book, game, or character later released under the name.",
      context: [
        "Archival timelines place Lucas’s first Star Wars-related character lists and story work in early 1973. The familiar film emerged through several years of treatments, drafts, concept art, financing, and production rather than arriving as a fixed mythology.",
        "The first theatrical film opened in 1977. Its success made the story world expandable, but the graph entity represents the broader franchise, not only the movie later subtitled A New Hope.",
        "Lucasfilm’s own account describes Lucas as creating the original universe and later storytellers as expanding it. That distinction matters because franchise creation and authorship of an individual later work are different claims.",
        "American Film Institute archival material corroborates that Lucas was developing Star Wars in the early 1970s, before American Graffiti’s commercial success gave him greater leverage for the project.",
      ],
      limitations: [
        "The creator edge describes the franchise’s originating concept. It does not credit Lucas with sole authorship, direction, or production of every later Star Wars work.",
        "Creator is not the same relationship as present ownership. This page does not use the P170 edge to make a claim about current corporate control of the franchise.",
      ],
      verificationSources: [
        {
          label: "The Legendary Star Wars Expanded Universe Turns a New Page",
          publisher: "StarWars.com / Lucasfilm",
          url: "https://www.starwars.com/news/the-legendary-star-wars-expanded-universe-turns-a-new-page",
          evidenceRole: "primary-source",
          supports: [
            "Lucasfilm’s description of George Lucas as the creator of the original Star Wars universe and of later storytellers expanding it.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "George Lucas tells the Star Wars origin story",
          publisher: "American Film Institute",
          url: "https://www.afi.com/from-the-archives-george-lucas-tells-the-star-wars-origin-story/",
          evidenceRole: "independent-corroboration",
          supports: [
            "Lucas’s development of Star Wars in the early 1970s and the project’s place in his filmmaking career before the 1977 release.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Making of Star Wars timeline",
          publisher: "University of Illinois Rare Book & Manuscript Library",
          url: "https://exhibits.library.illinois.edu/s/rbml/page/star-wars-timeline",
          evidenceRole: "context-source",
          supports: [
            "The early-1973 character and location work, the successive development process, and the financing path toward the first film.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Star Wars creator statement (P170)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q462#P170",
          evidenceRole: "structured-claim",
          supports: [
            "The P170 creator edge from Star Wars to George Lucas.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "George Lucas is the creator attached to Star Wars’s originating concept, but that concise graph edge sits above a long development history. Early drafts changed substantially before the 1977 film, and the resulting universe became a framework in which many later writers, directors, designers, performers, and producers created distinct works.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
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
      headline: "Tim Berners-Lee invented the Web by joining hypertext to an Internet that already existed.",
      introduction:
        "The Web and the Internet are often treated as synonyms, but they are different layers of history. Tim Berners-Lee’s invention was a global hypertext system that used existing Internet networking to identify documents, transfer them, and let readers follow links among them.",
      relationshipMeaning:
        "Wikidata uses P61, “discoverer or inventor,” from the World Wide Web to Tim Berners-Lee. Its record also names Robert Cailliau. The edge establishes Berners-Lee’s inventor relationship, while the source record separates his 1989 proposal and implementation from Cailliau’s important role in formalizing and promoting the project.",
      context: [
        "Berners-Lee circulated Information Management: A Proposal at CERN in March 1989. It addressed a practical institutional problem: information on incompatible computers was difficult for a changing international research community to find and connect.",
        "In November 1990, Berners-Lee and Robert Cailliau formalized the WorldWideWeb project. By Christmas, Berners-Lee had implemented the first server and browser-editor and the core conventions now known as HTML, HTTP, and URLs.",
        "The Internet supplied the network; the Web supplied a linked-document system that could run over it. Internet history therefore predates 1989, and many Internet services can exist without being Web pages.",
        "CERN’s 30 April 1993 decision to make the Web software freely available without royalties was not the invention itself, but it was crucial to adoption because other institutions and developers could implement and extend the system without a license fee.",
      ],
      limitations: [
        "The World Wide Web is not the Internet itself. The edge does not credit Berners-Lee with inventing packet networking, the Internet, or every later Web standard and browser.",
        "Berners-Lee’s inventor credit should not erase Robert Cailliau’s work on the 1990 proposal and early advocacy, or the many developers and institutions that made the Web interoperable and global.",
      ],
      verificationSources: [
        {
          label: "The birth of the Web",
          publisher: "CERN",
          url: "https://home.cern/science/computing/the-birth-of-the-web/",
          evidenceRole: "primary-source",
          supports: [
            "The 1989 proposal at CERN and Berners-Lee’s 1990 implementation of the Web’s foundational technologies.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "The World Wide Web: a very short personal history",
          publisher: "World Wide Web Consortium",
          url: "https://www.w3.org/People/Berners-Lee/ShortHistory.html",
          evidenceRole: "primary-source",
          supports: [
            "Berners-Lee’s account of the 1989 global-hypertext proposal, his 1990 WorldWideWeb browser-editor, and Robert Cailliau’s early advocacy.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "A brief history of the Internet",
          publisher: "Internet Society",
          url: "https://www.internetsociety.org/internet/history-internet/brief-history-internet/",
          evidenceRole: "independent-corroboration",
          supports: [
            "The Internet’s development before the Web and the distinction between networking infrastructure and the later Web community and standards.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "World Wide Web inventor statement (P61)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q466#P61",
          evidenceRole: "structured-claim",
          supports: [
            "The P61 inventor edge from the World Wide Web to Tim Berners-Lee and the record’s additional inventor entry.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Tim Berners-Lee’s inventor edge marks the person who proposed and implemented the first working Web at CERN. What made that invention consequential was the combination of already-existing Internet connectivity with a simple linked-document architecture—and, later, CERN’s choice to let anyone use and improve the software without royalties.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
    indexEligible: true,
    relatedSlugs: ["nasa-dwight-eisenhower", "tesla-spacex", "world-wide-web-tim-berners-lee"],
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
      headline: "Neil Armstrong commanded Apollo 11, a three-person mission with three different flight jobs.",
      introduction:
        "Apollo 11’s most familiar image is Neil Armstrong stepping onto the Moon, but the mission depended on a deliberately divided three-person crew. Armstrong commanded the flight, Buzz Aldrin piloted the lunar module, and Michael Collins piloted the command module that had to bring the crew home.",
      relationshipMeaning:
        "Wikidata uses P1029, “crew member,” from Apollo 11 to Armstrong. The position-held qualifier matters: it specifies spacecraft commander rather than merely associating him with the mission. The graph records membership and role, while NASA’s mission documentation explains what that role meant operationally.",
      context: [
        "Apollo 11 launched on 16 July 1969 and returned on 24 July. NASA’s mission report identifies Armstrong as commander, Collins as command module pilot, and Aldrin as lunar module pilot.",
        "Armstrong and Aldrin descended in Eagle while Collins remained in lunar orbit aboard Columbia. Collins’s separate job was essential: the lunar crew had to rendezvous and dock with the command module before all three could return to Earth.",
        "Armstrong’s first step occurred at 10:56 p.m. Eastern Daylight Time on 20 July, which was 02:56 UTC on 21 July. Both calendar dates appear in responsible accounts because they use different time zones.",
        "Command did not make Apollo 11 a solo achievement. The crew roles sat inside a much larger system of flight controllers, engineers, technicians, contractors, and earlier missions that tested the spacecraft and procedures.",
      ],
      limitations: [
        "The edge records Armstrong as a crew member with a command-role qualifier. It does not imply that Apollo 11 was a one-person mission or that Collins and Aldrin had subordinate, interchangeable tasks.",
        "A date given for the first step must identify its time zone: 20 July in United States Eastern time and 21 July in UTC are descriptions of the same moment.",
      ],
      verificationSources: [
        {
          label: "Apollo 11 mission overview",
          publisher: "NASA",
          url: "https://www.nasa.gov/history/apollo-11-mission-overview/",
          evidenceRole: "primary-source",
          supports: [
            "Apollo 11’s mission dates, three-person crew, and Armstrong’s role as commander.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Apollo 11 mission report",
          publisher: "NASA",
          url: "https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf",
          evidenceRole: "primary-source",
          supports: [
            "The contemporaneous assignment of Armstrong, Collins, and Aldrin to their three flight roles and the mission timestamp for Armstrong’s first surface contact.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Apollo 11 archival overview",
          publisher: "Smithsonian National Air and Space Museum",
          url: "https://airandspace.si.edu/collection-archive-item/apollo-launches-506-apollo-11/sova-nasm-xxxx-0093-ref1081",
          evidenceRole: "independent-corroboration",
          supports: [
            "The three-person mission, Armstrong and Aldrin’s lunar descent, Collins’s continued command-module orbit, and the crew’s 24 July return.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Apollo 11 crew statement (P1029)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q43653#P1029",
          evidenceRole: "structured-claim",
          supports: [
            "The P1029 crew-member edge to Armstrong and its spacecraft-commander role qualifier.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Neil Armstrong’s connection to Apollo 11 is not simply that he was the first person seen stepping onto the Moon: he was the spacecraft commander responsible for the mission and crew. Reading that role alongside Aldrin’s lunar-module work and Collins’s command-module orbit turns a famous individual moment back into the coordinated three-person flight it actually was.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
    indexEligible: true,
    relatedSlugs: ["jim-kelly-buffalo-bills"],
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
      headline: "Michael Jordan’s six Bulls titles came in two three-peats separated by retirement.",
      introduction:
        "Michael Jordan’s Bulls career is often compressed into one dynasty, but the dates preserve a more revealing shape: a first run that ended after three championships, a retirement and baseball interlude, then a return that produced a second three-peat.",
      relationshipMeaning:
        "Wikidata uses P54, “member of sports team,” from Jordan to the Chicago Bulls. Two statements cover 1984–1993 and 1995–1998, so both date ranges are carried into the displayed edge. Treating them separately prevents a graph viewer from implying uninterrupted team membership.",
      context: [
        "Chicago selected Jordan third in the 1984 NBA Draft. His first Bulls period culminated in championships in 1991, 1992, and 1993 before he retired from basketball and played minor-league baseball.",
        "Jordan announced his return in March 1995 with the brief message “I’m back.” The comeback belongs to the 1994–95 season, which is why a year-only graph qualifier cannot express every roster and season boundary perfectly.",
        "The Bulls then won championships in 1996, 1997, and 1998. The two groups of three titles are historically connected, but the retirement interval is essential to understanding why the membership appears as two statements.",
        "Jordan later played for the Washington Wizards. The Bulls edge describes two historical team memberships, not his entire professional career and not a current relationship.",
      ],
      limitations: [
        "Team membership is historical and split across two statements. It should not be read as one uninterrupted stint, a current playing relationship, or Jordan’s complete NBA career.",
        "The six championships were team achievements across two different Bulls rosters. The connection does not attribute every win or the dynasty’s full construction to one player.",
      ],
      verificationSources: [
        {
          label: "Chicago Bulls franchise leaders and Hall of Fame players",
          publisher: "NBA / Chicago Bulls",
          url: "https://www.nba.com/team/1610612741/franchise-leaders",
          evidenceRole: "primary-source",
          supports: [
            "The Bulls’ championship seasons and Jordan’s place in the franchise record during both title runs.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Michael Jordan Hall of Fame biography",
          publisher: "Naismith Memorial Basketball Hall of Fame",
          url: "https://www.hoophall.com/hall-of-famers/michael-jordan",
          evidenceRole: "independent-corroboration",
          supports: [
            "Jordan’s 1984 selection by Chicago, the first three championships, his 1993 retirement for minor-league baseball, his 1995 return, and the second three-title run.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Michael Jordan returns to the NBA in 1995",
          publisher: "NBA",
          url: "https://www.nba.com/news/legendary-moments-michael-jordan-returns-nba-1995",
          evidenceRole: "primary-source",
          supports: [
            "The March 1995 return announcement, the 17-month retirement interval, and Jordan’s re-entry during the 1994–95 season.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Michael Jordan team-membership statements (P54)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q41421#P54",
          evidenceRole: "structured-claim",
          supports: [
            "The two P54 Bulls membership statements and their 1984–1993 and 1995–1998 qualifiers.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Michael Jordan’s two Bulls statements encode the interruption that a simple team label would hide. His 1984–1993 tenure ended after a first three-peat; he returned during the 1994–95 season and played through 1998, when Chicago completed a second three-peat. The gap is not trivia—it explains the structure of the evidence.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
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
      headline: "Larry Page co-founded Google after PageRank turned Web links into evidence of importance.",
      introduction:
        "Google began as a Stanford research problem before it became a corporation. Larry Page and Sergey Brin explored whether the Web’s link structure could rank pages more meaningfully than systems that treated every page as an isolated block of text.",
      relationshipMeaning:
        "Google’s Wikidata record uses P112, “founded by,” for Larry Page. Since the page begins with Page, the relationship is displayed as the reverse phrase “co-founded.” That corporate edge is separate from the research claims about BackRub and PageRank, which are supported by Stanford, NSF, and the authors’ paper.",
      context: [
        "Page met Brin at Stanford in 1995, and their research collaboration produced a prototype called BackRub. The name referred to the system’s analysis of backlinks between pages.",
        "PageRank treated a link partly like a scholarly citation: a page gained importance when other important pages linked to it. The method considered the structure and quality of links, not just a raw count or the words appearing on a page.",
        "The 1998 research paper described Google as a large-scale search-engine prototype and discussed both its technical architecture and the tension between advertising incentives and search quality. The company grew out of research that already had a public scholarly rationale.",
        "Google was incorporated in 1998 after the project attracted users and investment. Page’s founder relationship therefore does not make him the sole inventor: Brin was his co-author and co-founder, and Stanford and federal research support were part of the project’s institutional setting.",
      ],
      limitations: [
        "The edge identifies Page as a co-founder. It does not describe him as Google’s only founder, the sole author of PageRank, or the inventor of every later Google search system.",
        "BackRub, PageRank, the Google prototype, and Google Inc. are related stages, not interchangeable names for one event that happened on a single date.",
      ],
      verificationSources: [
        {
          label: "How Google started",
          publisher: "Google",
          url: "https://about.google/company-info/our-story/",
          evidenceRole: "primary-source",
          supports: [
            "Google’s account of Page and Brin’s 1996 Stanford project and the company’s formal establishment in 1998.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "The Anatomy of a Large-Scale Hypertextual Web Search Engine",
          publisher: "Stanford University",
          url: "https://web.stanford.edu/class/archive/cs/cs240/cs240.1046/readings/google.pdf",
          evidenceRole: "primary-source",
          supports: [
            "Page and Brin’s published description of Google’s prototype architecture, PageRank’s citation-based importance model, and their discussion of advertising incentives.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "On the origins of Google",
          publisher: "U.S. National Science Foundation",
          url: "https://www.nsf.gov/impacts/google",
          evidenceRole: "independent-corroboration",
          supports: [
            "The BackRub prototype, Brin and Page’s joint work, the PageRank approach, research funding, and the transition from Stanford project to incorporated company.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Google founder statement (P112)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q95#P112",
          evidenceRole: "structured-claim",
          supports: [
            "The P112 founder edge from Google to Larry Page.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Larry Page’s co-founder edge becomes meaningful when paired with the research path that preceded the company. Page and Sergey Brin built BackRub to study links, developed PageRank to infer importance from those links, described the resulting Google prototype in academic work, and then incorporated a company around the project in 1998.",
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
    verifiedAt: PHASE_10B_REVIEWED_AT,
    indexEligible: true,
    relatedSlugs: [],
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
      headline: "Paris is France’s capital, but 5 October 1789 is a graph qualifier—not the city’s first day as a capital.",
      introduction:
        "Paris is unquestionably France’s present capital, yet a single start date oversimplifies how capitals work. Paris retained the title of capital while the royal court and seat of government moved to Versailles, and the revolutionary return of political institutions unfolded over several days rather than at one clean timestamp.",
      relationshipMeaning:
        "Wikidata uses P36, “capital,” from France to Paris. Its preferred statement carries a 5 October 1789 start qualifier. That value is displayed because it is part of the reviewed structured statement; the historical sources support the October 1789 transfer back toward Paris but do not establish 5 October as a precise legal creation date for Paris’s capital status.",
      context: [
        "Paris is the present national capital and the near-continuous seat of republican government, with exceptional interruptions during wars and political crises.",
        "Louis XIV moved the court and seat of government to Versailles in 1682. The Palace of Versailles’s own history stresses an important distinction: Versailles became the government center, but Paris did not lose its title as capital.",
        "The Women’s March reached Versailles on 5 October 1789; the royal family left for Paris on 6 October, and the National Assembly moved afterward. The graph’s 5 October value is best read as a structured marker for that revolutionary transition, not a complete chronology.",
        "Capital, royal residence, seat of government, and wartime administrative center are related but not identical concepts. Keeping them separate explains why historical capital lists can appear to conflict while describing different institutions.",
      ],
      limitations: [
        "The page preserves Wikidata’s 5 October 1789 qualifier, but independent historical sources do not make that day Paris’s first or uniquely definitive date as capital.",
        "The current capital edge does not claim uninterrupted government residence in Paris, nor does it mean Versailles ceased to matter politically after the royal family’s departure.",
      ],
      verificationSources: [
        {
          label: "The historical status of Paris",
          publisher: "City of Paris",
          url: "https://mairie06.paris.fr/pages/evolution-historique-9527",
          evidenceRole: "context-source",
          supports: [
            "Paris’s present capital status and its near-continuous role as the seat of republican government, subject to exceptional crises.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
        {
          label: "Versailles, ‘capital’ of the kingdom",
          publisher: "Palace of Versailles",
          url: "https://www.chateauversailles.fr/decouvrir/histoire/grandes-dates/versailles-capitale-royaume",
          evidenceRole: "primary-source",
          supports: [
            "The court and government’s 1682 move to Versailles and the institution’s explicit distinction between Versailles as government center and Paris retaining the title of capital.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "The departure of the king in 1789",
          publisher: "Palace of Versailles",
          url: "https://en.chateauversailles.fr/discover/history/key-dates/departure-king-1789",
          evidenceRole: "context-source",
          supports: [
            "The 5 October march, the royal family’s departure on 6 October, and Paris’s return as the political center of the kingdom.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "historical",
        },
        {
          label: "Paris, national capital of France",
          publisher: "Encyclopaedia Britannica",
          url: "https://www.britannica.com/place/Paris",
          evidenceRole: "independent-corroboration",
          supports: [
            "Paris’s present status as France’s capital and its long-standing central role in the French state.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
        {
          label: "France capital statement (P36)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q142#P36",
          evidenceRole: "structured-claim",
          supports: [
            "The preferred P36 capital edge to Paris, its 5 October 1789 qualifier, and the presence of separate historical capital statements.",
          ],
          reviewedAt: PHASE_10B_REVIEWED_AT,
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "France’s preferred graph statement correctly identifies Paris as the current capital, but its 5 October 1789 qualifier needs interpretation. Versailles had been the seat of court and government without fully displacing Paris’s capital title; the October Days brought the monarchy back across 5–6 October; and later crises again separated the formal capital from the government’s temporary location.",
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
      limitations: [
        "Shared executive leadership does not make Tesla and SpaceX the same business and does not establish a parent, subsidiary, or ownership relationship between them.",
        "The Roadster demonstration involved a prototype. A stated production target is not evidence that a finished product is shipping or approved.",
      ],
      verificationSources: [
        {
          label: "Elon Musk executive biography",
          publisher: "Tesla Investor Relations",
          url: "https://ir.tesla.com/corporate/elon-musk",
          evidenceRole: "primary-source",
          supports: [
            "Tesla’s identification of Musk as its chief executive and its account of his SpaceX leadership roles.",
          ],
          reviewedAt: "2026-10-17T16:00:00.000Z",
          freshness: "current-role",
        },
        {
          label: "SpaceX leadership",
          publisher: "SpaceX Investor Relations",
          url: "https://ir.spacex.com/leadership/",
          evidenceRole: "primary-source",
          supports: [
            "SpaceX’s leadership information used to corroborate the shared-executive connection.",
          ],
          reviewedAt: "2026-10-17T16:00:00.000Z",
          freshness: "current-role",
        },
        {
          label: "Tesla chief executive officer statement (P169)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q478214#P169",
          evidenceRole: "structured-claim",
          supports: [
            "The P169 edge from Tesla to Elon Musk used for the first step of the path.",
          ],
          reviewedAt: "2026-10-17T16:00:00.000Z",
          freshness: "current-role",
        },
        {
          label: "SpaceX chief executive officer statement (P169)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q193701#P169",
          evidenceRole: "structured-claim",
          supports: [
            "The P169 edge from SpaceX to Elon Musk, displayed in reverse for the second step of the path.",
          ],
          reviewedAt: "2026-10-17T16:00:00.000Z",
          freshness: "current-role",
        },
        {
          label: "Roadster prototype demonstration at SpaceX",
          publisher: "Associated Press",
          url: "https://apnews.com/article/7d5f19665435b7408025bfb7a2f2f0b7",
          evidenceRole: "independent-corroboration",
          supports: [
            "The 15 October 2026 prototype demonstration at a SpaceX site and the distinction between a demonstration and production availability.",
          ],
          reviewedAt: "2026-10-17T16:00:00.000Z",
          freshness: "time-sensitive",
        },
      ],
      editorialExplanation:
        "Tesla and SpaceX both identify Elon Musk as chief executive, creating a durable personnel connection between two otherwise separate companies. Tesla's October 2026 Roadster prototype demonstration at a SpaceX site supplied a timely example of technical collaboration, but prototype and production claims should not be confused with the verified executive path.",
    },
  },
  {
    slug: "jim-kelly-buffalo-bills",
    canonicalFromQid: "Q127819",
    canonicalToQid: "Q221626",
    category: "Sports",
    pathFingerprint: "hc-v1-646af643",
    expectedRelationships: [
      {
        propertyId: "P54",
        subjectQid: "Q127819",
        objectQid: "Q221626",
        pathDirection: "forward",
        qualifierPropertyIds: ["P580", "P582", "P1618"],
      },
    ],
    reviewStatus: "approved",
    verifiedAt: "2026-10-17T19:20:00.000Z",
    indexEligible: true,
    relatedSlugs: ["michael-jordan-chicago-bulls"],
    snapshot: directSnapshot({
      source: entity("Q127819", "Jim Kelly", "American football quarterback"),
      target: entity("Q221626", "Buffalo Bills", "National Football League franchise in Buffalo, New York"),
      sourceNode: node("Q127819", "Jim Kelly", "athlete", "Jim Kelly"),
      targetNode: node("Q221626", "Buffalo Bills", "sports team", "Buffalo Bills"),
      relationship: relationship(
        "member of sports team",
        "Jim Kelly",
        "Buffalo Bills",
        "P54",
        "forward",
        [
          qualifier("P580", "start time", "1986"),
          qualifier("P582", "end time", "1996"),
          qualifier("P1618", "sport number", "12"),
        ],
      ),
      headline: "Jim Kelly quarterbacked Buffalo through an unprecedented AFC run.",
      introduction:
        "Jim Kelly played quarterback for the Buffalo Bills from 1986 through 1996. His tenure included Buffalo's four consecutive AFC championships in the 1990–1993 seasons and the four Super Bowl appearances that followed—an unprecedented conference run, but not four Super Bowl victories.",
      relationshipMeaning:
        "Wikidata records P54, “member of sports team,” from Jim Kelly to the Buffalo Bills. Its upstream statement carries start and end qualifiers of 1986 and 1996, plus uniform number 12. The production Neo4j edge confirms the direct relationship and direction; it does not store those date qualifiers itself.",
      context: [
        "Kelly joined Buffalo before the 1986 NFL season and played his final Bills season in 1996, completing an 11-season NFL career with the franchise.",
        "Buffalo won the AFC championship in the 1990, 1991, 1992, and 1993 seasons, becoming the only NFL team to claim four consecutive conference titles.",
        "Those championships produced four consecutive Super Bowl appearances. Buffalo lost all four games, so the achievement is the run of conference championships and appearances—not Super Bowl victories.",
        "The 1986 and 1996 dates shown on this page come from qualifiers on Wikidata's P54 statement and are corroborated by official career records; they are not represented as qualifier properties on the Neo4j relationship.",
      ],
      limitations: [
        "Four consecutive AFC championships produced four Super Bowl appearances, not four Super Bowl victories.",
        "The date and uniform-number qualifiers come from the reviewed upstream Wikidata statement; the Neo4j edge confirms the relationship but does not store those qualifiers.",
      ],
      verificationSources: [
        {
          label: "Jim Kelly Hall of Fame profile",
          publisher: "Pro Football Hall of Fame",
          url: "https://www.profootballhof.com/players/jim-kelly",
          evidenceRole: "independent-corroboration",
          supports: [
            "Kelly’s 1986–1996 Buffalo career and the four consecutive AFC championship seasons.",
          ],
          reviewedAt: "2026-10-17T19:20:00.000Z",
          freshness: "historical",
        },
        {
          label: "Jim Kelly Buffalo Bills career profile",
          publisher: "Buffalo Bills",
          url: "https://www.buffalobills.com/team/alumni/hall-of-fame-profiles/jim-kelly",
          evidenceRole: "primary-source",
          supports: [
            "The Bills’ account of Kelly’s franchise career and early-1990s postseason run.",
          ],
          reviewedAt: "2026-10-17T19:20:00.000Z",
          freshness: "historical",
        },
        {
          label: "Jim Kelly career statistics",
          publisher: "NFL",
          url: "https://www.nfl.com/players/jim-kelly/stats/career",
          evidenceRole: "primary-source",
          supports: [
            "Official league career records used to corroborate Kelly’s Buffalo tenure.",
          ],
          reviewedAt: "2026-10-17T19:20:00.000Z",
          freshness: "historical",
        },
        {
          label: "Jim Kelly member of sports team statement (P54)",
          publisher: "Wikidata",
          url: "https://www.wikidata.org/wiki/Q127819#P54",
          evidenceRole: "structured-claim",
          supports: [
            "The P54 edge to the Buffalo Bills and its 1986, 1996, and number 12 qualifiers.",
          ],
          reviewedAt: "2026-10-17T19:20:00.000Z",
          freshness: "periodic",
        },
      ],
      editorialExplanation:
        "Jim Kelly's verified P54 statement points directly to the Buffalo Bills for 1986–1996. Across that career, he led Buffalo's defining early-1990s offense as the team won four consecutive AFC championships and reached four consecutive Super Bowls, a distinction that should not be misstated as four championship-game victories.",
    }),
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
  if (
    snapshot.limitations &&
    (!snapshot.limitations.length || snapshot.limitations.some((item) => !item.trim()))
  ) {
    errors.push("Snapshot has invalid relationship limitations.");
  }
  if (
    snapshot.verificationSources?.some((source) => {
      const hasRole = source.evidenceRole !== undefined;
      const hasSupports = source.supports !== undefined;
      const invalidReviewDate =
        source.reviewedAt !== undefined &&
        Number.isNaN(new Date(source.reviewedAt).getTime());
      return (
        (hasRole && !EDITORIAL_EVIDENCE_ROLES.has(source.evidenceRole!)) ||
        hasRole !== hasSupports ||
        (hasSupports &&
          (!source.supports?.length || source.supports.some((item) => !item.trim()))) ||
        (source.freshness !== undefined &&
          !EDITORIAL_FRESHNESS_CLASSES.has(source.freshness)) ||
        invalidReviewDate
      );
    })
  ) {
    errors.push("Snapshot has invalid evidence annotations.");
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
    ...(snapshot.limitations ?? []),
    ...(snapshot.verificationSources ?? []).flatMap(
      ({ label, publisher, url, supports }) => [
        label,
        publisher,
        url,
        ...(supports ?? []),
      ],
    ),
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
