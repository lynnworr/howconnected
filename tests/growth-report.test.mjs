import assert from "node:assert/strict";
import test from "node:test";
import { parseGrowthEventCsv, renderGrowthReport, summarizeGrowthEvents } from "../scripts/analyze-growth-events.mjs";

const sample = `date,event,segment_key,segment_value,count
2026-10-15,search_initiated,,,10
2026-10-15,search_initiated,origin,homepage,10
2026-10-15,search_succeeded,,,6
2026-10-15,search_succeeded,origin,homepage,6
2026-10-15,search_no_reliable_path,,,2
2026-10-15,search_no_reliable_path,origin,homepage,2
2026-10-15,search_timed_out,,,1
2026-10-15,search_timed_out,origin,homepage,1
2026-10-15,search_failed,,,1
2026-10-15,search_failed,origin,homepage,1
2026-10-15,daily_challenge_opened,,,20
2026-10-15,daily_challenge_answer_submitted,,,12
2026-10-15,daily_challenge_answer_submitted,isCorrect,true,9
2026-10-15,daily_challenge_completed,,,12
2026-10-15,daily_challenge_result_shared,,,3
2026-10-15,daily_wikipedia_link_clicked,,,5
2026-10-15,daily_evidence_link_clicked,,,4
2026-10-15,extension_referral_opened,,,7
2026-10-15,extension_referral_opened,destination,connection,4
2026-10-15,extension_referral_opened,destination,daily,3
2026-10-15,search_succeeded,origin,extension,2
2026-10-15,result_shared,origin,extension,1
2026-10-15,daily_challenge_completed,origin,extension,2
2026-10-15,daily_challenge_result_shared,origin,extension,1
2026-10-15,explore_connection_opened,,,8
2026-10-15,explore_category_selected,,,3
2026-10-15,related_connection_opened,,,2
2026-10-15,daily_continued_exploration,,,4
`;

test("growth report calculates documented event rates without double-counting segments", () => {
  const summary = summarizeGrowthEvents(parseGrowthEventCsv(sample));
  assert.equal(summary.search.successRate, 0.6);
  assert.equal(summary.search.outcomeCoverage, 1);
  assert.equal(summary.daily.completionRate, 0.6);
  assert.equal(summary.daily.correctAnswerRate, 0.75);
  assert.equal(summary.daily.shareRate, 0.25);
  assert.deepEqual(summary.extension, {
    referrals: 7, connectionReferrals: 4, dailyReferrals: 3, successfulConnections: 2,
    connectionShares: 1, dailyCompletions: 2, dailyShares: 1,
  });
  assert.match(renderGrowthReport(summary), /Counts are event occurrences, not unique people/);
});

test("growth report rejects unsupported fields instead of accepting arbitrary exports", () => {
  assert.throws(() => parseGrowthEventCsv("event,date,count\nsearch_initiated,2026-10-15,1\n"), /Expected CSV header/);
  assert.throws(() => parseGrowthEventCsv("date,event,segment_key,segment_value,count\n2026-10-15,unknown,,,1\n"), /unknown event/);
  assert.throws(() => parseGrowthEventCsv("date,event,segment_key,segment_value,count\n2026-10-15,search_initiated,query,private,1\n"), /unsupported segment key/);
  assert.throws(() => parseGrowthEventCsv("date,event,segment_key,segment_value,count\n2026-10-15,search_initiated,,,-1\n"), /invalid count/);
  assert.throws(() => parseGrowthEventCsv("date,event,segment_key,segment_value,count\n2026-02-31,search_initiated,,,1\n"), /invalid date/);
});
