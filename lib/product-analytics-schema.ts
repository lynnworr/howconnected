export const PRODUCT_EVENT_NAMES = [
  "entity_lookup_completed",
  "search_initiated",
  "search_succeeded",
  "search_no_reliable_path",
  "search_timed_out",
  "search_failed",
  "alternate_paths_opened",
  "result_shared",
  "surprise_me_used",
  "entity_source_opened",
  "try_another_clicked",
  "additional_search_started",
  "surprise_me_shuffled",
  "explore_connection_opened",
  "explore_category_selected",
  "related_connection_opened",
  "result_next_action_clicked",
  "extension_referral_opened",
  "daily_challenge_opened",
  "daily_challenge_answer_submitted",
  "daily_challenge_completed",
  "daily_wikipedia_link_clicked",
  "daily_evidence_link_clicked",
  "daily_challenge_result_shared",
  "daily_continued_exploration",
  "widget_link_opened",
  "publisher_landing_opened",
  "publisher_demo_interacted",
  "widget_embed_snippet_copied",
  "publisher_request_cta_clicked",
  "publisher_request_submitted",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
export type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;
type SanitizedProperties = Record<string, string | number | boolean | null>;

const QID = /^Q[1-9]\d*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EVENT_KEYS: Record<ProductEventName, readonly string[]> = {
  entity_lookup_completed: ["queryLength", "resultCount"],
  search_initiated: ["fromQid", "toQid", "origin", "sessionConnectionNumber"],
  search_succeeded: ["fromQid", "toQid", "steps", "alternatePathCount", "origin"],
  search_no_reliable_path: ["fromQid", "toQid", "origin", "sessionConnectionNumber", "failureCategory"],
  search_timed_out: ["fromQid", "toQid", "origin", "sessionConnectionNumber", "failureCategory"],
  search_failed: ["fromQid", "toQid", "origin", "sessionConnectionNumber", "failureCategory"],
  alternate_paths_opened: ["fromQid", "toQid", "alternatePathCount"],
  result_shared: ["fromQid", "toQid", "steps", "method", "origin"],
  surprise_me_used: ["pairId", "fromQid", "toQid"],
  entity_source_opened: ["entityQid", "destinationType", "sourceContext"],
  try_another_clicked: ["fromQid", "toQid", "origin"],
  additional_search_started: ["fromQid", "toQid", "sessionConnectionNumber"],
  surprise_me_shuffled: ["previousPairId", "nextPairId"],
  explore_connection_opened: ["connection", "placement"],
  explore_category_selected: ["category"],
  related_connection_opened: ["sourceConnection", "relatedConnection"],
  result_next_action_clicked: ["destination", "fromQid", "toQid"],
  extension_referral_opened: ["destination", "fromQid", "toQid", "puzzleId", "category"],
  daily_challenge_opened: ["puzzleId", "category", "utcDate", "origin"],
  daily_challenge_answer_submitted: ["puzzleId", "category", "isCorrect", "origin"],
  daily_challenge_completed: ["puzzleId", "category", "isCorrect", "origin"],
  daily_wikipedia_link_clicked: ["puzzleId", "category", "linkType", "origin"],
  daily_evidence_link_clicked: ["puzzleId", "category", "linkType", "origin"],
  daily_challenge_result_shared: ["puzzleId", "category", "method", "origin"],
  daily_continued_exploration: ["puzzleId", "category", "origin"],
  widget_link_opened: ["connection", "destination"],
  publisher_landing_opened: [],
  publisher_demo_interacted: ["action"],
  widget_embed_snippet_copied: [],
  publisher_request_cta_clicked: ["publisherPlacement"],
  publisher_request_submitted: ["requestScope", "commercialInterest"],
};

const REQUIRED_KEYS: Record<ProductEventName, readonly string[]> = {
  entity_lookup_completed: ["queryLength", "resultCount"],
  search_initiated: ["fromQid", "toQid", "origin", "sessionConnectionNumber"],
  search_succeeded: ["fromQid", "toQid", "steps", "alternatePathCount", "origin"],
  search_no_reliable_path: ["fromQid", "toQid", "origin"],
  search_timed_out: ["fromQid", "toQid", "origin"],
  search_failed: ["fromQid", "toQid", "origin"],
  alternate_paths_opened: ["fromQid", "toQid", "alternatePathCount"],
  result_shared: ["fromQid", "toQid", "steps", "method"],
  surprise_me_used: ["pairId", "fromQid", "toQid"],
  entity_source_opened: ["entityQid", "destinationType", "sourceContext"],
  try_another_clicked: ["origin"],
  additional_search_started: ["fromQid", "toQid", "sessionConnectionNumber"],
  surprise_me_shuffled: ["previousPairId", "nextPairId"],
  explore_connection_opened: ["connection", "placement"],
  explore_category_selected: ["category"],
  related_connection_opened: ["sourceConnection", "relatedConnection"],
  result_next_action_clicked: ["destination", "fromQid", "toQid"],
  extension_referral_opened: [],
  daily_challenge_opened: ["puzzleId", "category", "utcDate"],
  daily_challenge_answer_submitted: ["puzzleId", "category", "isCorrect"],
  daily_challenge_completed: ["puzzleId", "category", "isCorrect"],
  daily_wikipedia_link_clicked: ["puzzleId", "category", "linkType"],
  daily_evidence_link_clicked: ["puzzleId", "category", "linkType"],
  daily_challenge_result_shared: ["puzzleId", "category", "method"],
  daily_continued_exploration: ["puzzleId", "category"],
  widget_link_opened: ["connection", "destination"],
  publisher_landing_opened: [],
  publisher_demo_interacted: ["action"],
  widget_embed_snippet_copied: [],
  publisher_request_cta_clicked: ["publisherPlacement"],
  publisher_request_submitted: ["requestScope"],
};

const ENUMS: Record<string, readonly string[]> = {
  origin: ["homepage", "shared_url", "extension", "daily_share", "connection_share", "publisher_widget"],
  failureCategory: ["none", "no_strong_path", "semantic_quality_rejection", "timeout_or_budget", "upstream_wikidata", "neo4j_unavailable", "entity_not_found", "discovery_service"],
  method: ["copy_link", "share_fallback_copy", "native_share", "clipboard"],
  destinationType: ["wikipedia", "wikidata"],
  sourceContext: ["path", "share_card"],
  placement: ["card", "featured"],
  destination: ["explore", "surprise_me", "connection", "daily", "wikipedia", "wikidata", "evidence", "publisher_info"],
  linkType: ["wikipedia", "evidence"],
  category: [
    "Business", "Entertainment and film", "Geography and culture", "History and politics", "Literature and art", "Music", "Science and innovation", "Sports", "Technology",
    "Business & technology", "Entertainment & media", "History", "Places & culture", "Science & innovation",
  ],
  action: ["open_demo"],
  publisherPlacement: ["hero", "examples", "limitations"],
  requestScope: ["one_widget", "ongoing_use"],
  commercialInterest: ["occasional_custom", "ongoing_publishing", "maybe_price", "not_currently"],
};

const INTEGER_KEYS = new Set(["queryLength", "resultCount", "sessionConnectionNumber", "steps", "alternatePathCount"]);
const QID_KEYS = new Set(["fromQid", "toQid", "entityQid"]);
const SLUG_KEYS = new Set(["pairId", "previousPairId", "nextPairId", "connection", "sourceConnection", "relatedConnection", "puzzleId"]);

function isUtcDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function validValue(key: string, value: unknown): value is string | number | boolean | null {
  if (value === null) return false;
  if (key === "isCorrect") return typeof value === "boolean";
  if (INTEGER_KEYS.has(key)) return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000;
  if (QID_KEYS.has(key)) return typeof value === "string" && QID.test(value);
  if (SLUG_KEYS.has(key)) return typeof value === "string" && value.length <= 120 && SLUG.test(value);
  if (key === "utcDate") return typeof value === "string" && isUtcDate(value);
  if (ENUMS[key]) return typeof value === "string" && ENUMS[key].includes(value);
  return false;
}

export function sanitizeProductEvent(
  name: ProductEventName,
  properties: ProductEventProperties = {},
): SanitizedProperties | null {
  const allowed = new Set(EVENT_KEYS[name]);
  const sanitized: SanitizedProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (!allowed.has(key) || !validValue(key, value)) return null;
    sanitized[key] = value;
  }
  if (REQUIRED_KEYS[name].some((key) => sanitized[key] === undefined)) return null;
  if (name === "extension_referral_opened") {
    const connectionReferral = sanitized.destination === "connection" && Boolean(sanitized.fromQid && sanitized.toQid) && !sanitized.puzzleId && !sanitized.category;
    const dailyReferral = sanitized.destination === "daily" && Boolean(sanitized.puzzleId && sanitized.category) && !sanitized.fromQid && !sanitized.toQid;
    if (!connectionReferral && !dailyReferral) return null;
  }
  return sanitized;
}

export function getProductEventKeys(name: ProductEventName): readonly string[] {
  return EVENT_KEYS[name];
}
