import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_EVENT_NAMES } from "../lib/product-analytics-schema.ts";

const EXPECTED_COLUMNS = ["date", "event", "segment_key", "segment_value", "count"];
const SEGMENT_KEYS = new Set(["", "origin", "isCorrect", "destination", "category", "method", "placement", "publisherPlacement", "requestScope", "commercialInterest", "action", "connection", "navigationPlacement", "extensionPlacement", "recommendationSurface", "recommendationReason"]);
const EVENT_NAMES = new Set(PRODUCT_EVENT_NAMES);

function isUtcDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.trim()));
}

export function parseGrowthEventCsv(text) {
  const [header, ...records] = parseCsv(text);
  if (!header || JSON.stringify(header) !== JSON.stringify(EXPECTED_COLUMNS)) {
    throw new Error(`Expected CSV header: ${EXPECTED_COLUMNS.join(",")}`);
  }
  return records.map((record, index) => {
    if (record.length !== EXPECTED_COLUMNS.length) throw new Error(`Row ${index + 2} has ${record.length} columns.`);
    const [date, event, segmentKey, segmentValue, rawCount] = record.map((value) => value.trim());
    const count = Number(rawCount);
    if (!isUtcDate(date)) throw new Error(`Row ${index + 2} has an invalid date.`);
    if (!EVENT_NAMES.has(event)) throw new Error(`Row ${index + 2} has an unknown event.`);
    if (!SEGMENT_KEYS.has(segmentKey)) throw new Error(`Row ${index + 2} has an unsupported segment key.`);
    if ((!segmentKey && segmentValue) || (segmentKey && !segmentValue)) throw new Error(`Row ${index + 2} has an incomplete segment.`);
    if (!Number.isInteger(count) || count < 0) throw new Error(`Row ${index + 2} has an invalid count.`);
    return { date, event, segmentKey, segmentValue, count };
  });
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

export function summarizeGrowthEvents(rows) {
  const total = (event) => rows.filter((row) => row.event === event && !row.segmentKey).reduce((sum, row) => sum + row.count, 0);
  const segment = (event, key, value) => rows.filter((row) => row.event === event && row.segmentKey === key && row.segmentValue === value).reduce((sum, row) => sum + row.count, 0);
  const searchesInitiated = total("search_initiated");
  const successfulSearches = total("search_succeeded");
  const noReliablePath = total("search_no_reliable_path");
  const timeouts = total("search_timed_out");
  const failures = total("search_failed");
  const searchOutcomes = successfulSearches + noReliablePath + timeouts + failures;
  const homepageInitiated = segment("search_initiated", "origin", "homepage");
  const homepageSuccessful = segment("search_succeeded", "origin", "homepage");
  const homepageNoPath = segment("search_no_reliable_path", "origin", "homepage");
  const homepageTimeouts = segment("search_timed_out", "origin", "homepage");
  const homepageFailures = segment("search_failed", "origin", "homepage");
  const homepageOutcomes = homepageSuccessful + homepageNoPath + homepageTimeouts + homepageFailures;
  const dailyOpens = total("daily_challenge_opened");
  const dailySubmissions = total("daily_challenge_answer_submitted");
  const dailyCompletions = total("daily_challenge_completed");
  const dailyShares = total("daily_challenge_result_shared");
  const extensionReferrals = total("extension_referral_opened");
  const publisherLandingOpens = total("publisher_landing_opened");
  const publisherCtaClicks = total("publisher_request_cta_clicked");
  const publisherRequests = total("publisher_request_submitted");
  const homepageExamples = total("homepage_example_opened");
  const homepageSearchExamples = total("homepage_search_example_selected");
  const homepageDiscoveryActions = total("homepage_discovery_interacted");
  const navigationClicks = total("navigation_link_clicked");
  const extensionInstallClicks = total("extension_install_clicked");
  const recommendationImpressions = total("recommended_connection_impression");
  const recommendationOpens = total("recommended_connection_opened");
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  return {
    period: { start: dates[0] ?? null, end: dates.at(-1) ?? null, daysWithRows: dates.length },
    search: {
      initiated: searchesInitiated, successful: successfulSearches, noReliablePath, timeouts, failures, outcomes: searchOutcomes,
      homepageInitiated, homepageSuccessful, homepageOutcomes,
      successRate: rate(homepageSuccessful, homepageOutcomes), outcomeCoverage: rate(homepageOutcomes, homepageInitiated),
    },
    daily: {
      opens: dailyOpens, submissions: dailySubmissions, completions: dailyCompletions,
      correctSubmissions: segment("daily_challenge_answer_submitted", "isCorrect", "true"), shares: dailyShares,
      wikipediaClicks: total("daily_wikipedia_link_clicked"), evidenceClicks: total("daily_evidence_link_clicked"),
      completionRate: rate(dailyCompletions, dailyOpens), submissionRate: rate(dailySubmissions, dailyOpens),
      correctAnswerRate: rate(segment("daily_challenge_answer_submitted", "isCorrect", "true"), dailySubmissions),
      shareRate: rate(dailyShares, dailyCompletions),
    },
    extension: {
      referrals: extensionReferrals,
      connectionReferrals: segment("extension_referral_opened", "destination", "connection"),
      dailyReferrals: segment("extension_referral_opened", "destination", "daily"),
      successfulConnections: segment("search_succeeded", "origin", "extension"),
      connectionShares: segment("result_shared", "origin", "extension"),
      dailyCompletions: segment("daily_challenge_completed", "origin", "extension"),
      dailyShares: segment("daily_challenge_result_shared", "origin", "extension"),
    },
    discovery: {
      exploreConnectionOpens: total("explore_connection_opened"), categorySelections: total("explore_category_selected"),
      relatedConnectionOpens: total("related_connection_opened"), continuedFromDaily: total("daily_continued_exploration"),
      recommendationImpressions, recommendationOpens,
      recommendationOpenRate: rate(recommendationOpens, recommendationImpressions),
      resultRecommendationOpens: segment("recommended_connection_opened", "recommendationSurface", "result"),
      dailyRecommendationOpens: segment("recommended_connection_opened", "recommendationSurface", "daily"),
      resultContinuationActions: total("result_next_action_clicked"),
      homepageExamples, homepageSearchExamples, homepageDiscoveryActions, navigationClicks, extensionInstallClicks,
    },
    publisher: {
      landingOpens: publisherLandingOpens,
      demoInteractions: total("publisher_demo_interacted"),
      snippetCopies: total("widget_embed_snippet_copied"),
      requestCtaClicks: publisherCtaClicks,
      successfulRequests: publisherRequests,
      occasionalCustomInterest: segment("publisher_request_submitted", "commercialInterest", "occasional_custom"),
      ongoingPublishingInterest: segment("publisher_request_submitted", "commercialInterest", "ongoing_publishing"),
      maybeDependingOnPrice: segment("publisher_request_submitted", "commercialInterest", "maybe_price"),
      notCurrentlyInterested: segment("publisher_request_submitted", "commercialInterest", "not_currently"),
      requestRateFromCta: rate(publisherRequests, publisherCtaClicks),
    },
  };
}

function percent(value) { return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`; }

export function renderGrowthReport(summary) {
  return [
    "# HowConnected growth event summary",
    "",
    `Period: ${summary.period.start ?? "n/a"} to ${summary.period.end ?? "n/a"} (${summary.period.daysWithRows} day(s) with rows)`,
    "",
    "## Search",
    `- Initiated: ${summary.search.initiated}`,
    `- Successful: ${summary.search.successful}`,
    `- No reliable path: ${summary.search.noReliablePath}`,
    `- Timeouts: ${summary.search.timeouts}`,
    `- Failures: ${summary.search.failures}`,
    `- Homepage success rate among segmented outcomes: ${percent(summary.search.successRate)}`,
    `- Homepage outcome coverage versus initiated searches: ${percent(summary.search.outcomeCoverage)}`,
    "",
    "## The Missing Link",
    `- Opens: ${summary.daily.opens}`,
    `- Submissions: ${summary.daily.submissions}`,
    `- Completions: ${summary.daily.completions}`,
    `- Completion rate: ${percent(summary.daily.completionRate)}`,
    `- Correct-answer rate: ${percent(summary.daily.correctAnswerRate)}`,
    `- Shares: ${summary.daily.shares} (${percent(summary.daily.shareRate)} of completions)`,
    `- Wikipedia clicks: ${summary.daily.wikipediaClicks}`,
    `- Evidence clicks: ${summary.daily.evidenceClicks}`,
    "",
    "## Extension",
    `- Referrals: ${summary.extension.referrals}`,
    `- Connection referrals: ${summary.extension.connectionReferrals}`,
    `- Daily referrals: ${summary.extension.dailyReferrals}`,
    `- Successful referred connections: ${summary.extension.successfulConnections}`,
    `- Referred connection shares: ${summary.extension.connectionShares}`,
    `- Referred daily completions: ${summary.extension.dailyCompletions}`,
    `- Referred daily shares: ${summary.extension.dailyShares}`,
    "",
    "## Discovery",
    `- Explore connection opens: ${summary.discovery.exploreConnectionOpens}`,
    `- Category selections: ${summary.discovery.categorySelections}`,
    `- Related connection opens: ${summary.discovery.relatedConnectionOpens}`,
    `- Recommendation impressions: ${summary.discovery.recommendationImpressions}`,
    `- Recommendation opens: ${summary.discovery.recommendationOpens} (${percent(summary.discovery.recommendationOpenRate)} of impressions)`,
    `- Result recommendation opens: ${summary.discovery.resultRecommendationOpens}`,
    `- Daily recommendation opens: ${summary.discovery.dailyRecommendationOpens}`,
    `- Result continuation actions: ${summary.discovery.resultContinuationActions}`,
    `- Continued from daily: ${summary.discovery.continuedFromDaily}`,
    `- Homepage reviewed examples opened: ${summary.discovery.homepageExamples}`,
    `- Homepage search examples selected: ${summary.discovery.homepageSearchExamples}`,
    `- Homepage discovery actions: ${summary.discovery.homepageDiscoveryActions}`,
    `- Navigation clicks: ${summary.discovery.navigationClicks}`,
    `- Chrome Web Store CTA clicks: ${summary.discovery.extensionInstallClicks}`,
    "",
    "## Publisher pilot",
    `- Landing opens: ${summary.publisher.landingOpens}`,
    `- Explicit demo interactions: ${summary.publisher.demoInteractions}`,
    `- Successful snippet copies: ${summary.publisher.snippetCopies}`,
    `- Request CTA clicks: ${summary.publisher.requestCtaClicks}`,
    `- Successful requests: ${summary.publisher.successfulRequests}`,
    `- Request rate from CTA clicks: ${percent(summary.publisher.requestRateFromCta)}`,
    `- Occasional custom interest: ${summary.publisher.occasionalCustomInterest}`,
    `- Ongoing publishing interest: ${summary.publisher.ongoingPublishingInterest}`,
    `- Maybe, depending on price: ${summary.publisher.maybeDependingOnPrice}`,
    `- Not currently interested: ${summary.publisher.notCurrentlyInterested}`,
    "",
    "Counts are event occurrences, not unique people. Traffic, landing pages, referrers, and visitor estimates remain in Vercel Web Analytics.",
  ].join("\n");
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run growth:report -- <normalized-events.csv> [--json]");
  const rows = parseGrowthEventCsv(await readFile(path.resolve(input), "utf8"));
  const summary = summarizeGrowthEvents(rows);
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(summary, null, 2)}\n` : `${renderGrowthReport(summary)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
