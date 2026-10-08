import "server-only";

import neo4j from "neo4j-driver";
import {
  isPathFeedbackRating,
  summarizeFeedbackGroups,
  type AdminFeedbackDashboard,
  type AdminFeedbackEntry,
  type AdminFeedbackFilter,
  type FeedbackAggregateGroup,
} from "@/lib/admin-feedback-core";
import { getNeo4jDriver } from "@/lib/neo4j";
import { isValidQid } from "@/lib/wikidata-id";
import {
  PATH_FEEDBACK_REASONS,
  type PathFeedbackReason,
} from "@/lib/path-feedback";

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (neo4j.isInt(value)) return value.toNumber();
  return 0;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalTextValue(value: unknown): string | null {
  const text = textValue(value).trim();
  return text || null;
}

function timestampValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return value.toString();
  }
  return "";
}

function ratingForFilter(filter: AdminFeedbackFilter): string | null {
  if (filter === "positive") return "yes";
  if (filter === "negative") return "not_really";
  return null;
}

export async function getAdminFeedbackDashboard(
  filter: AdminFeedbackFilter,
  reason: PathFeedbackReason | null,
): Promise<AdminFeedbackDashboard> {
  const driver = getNeo4jDriver();
  const selectedReason =
    filter === "negative" &&
    reason !== null &&
    PATH_FEEDBACK_REASONS.includes(reason)
      ? reason
      : null;

  const [aggregateResult, recentResult] = await Promise.all([
    driver.executeQuery(
      `
        MATCH (feedback:PathFeedback)
        RETURN feedback.rating AS rating,
               feedback.reason AS reason,
               count(*) AS count
      `,
      {},
      { routing: neo4j.routing.READ },
    ),
    driver.executeQuery(
      `
        MATCH (feedback:PathFeedback)
        WHERE ($rating IS NULL OR feedback.rating = $rating)
          AND ($reason IS NULL OR feedback.reason = $reason)
        OPTIONAL MATCH (source:Entity {qid: feedback.fromQid})
        OPTIONAL MATCH (target:Entity {qid: feedback.toQid})
        RETURN feedback.id AS id,
               feedback.timestamp AS timestamp,
               feedback.fromQid AS fromQid,
               source.name AS fromName,
               feedback.toQid AS toQid,
               target.name AS toName,
               feedback.rating AS rating,
               feedback.reason AS reason,
               feedback.pathSteps AS pathSteps
        ORDER BY feedback.timestamp DESC
        LIMIT 50
      `,
      {
        rating: ratingForFilter(filter),
        reason: selectedReason,
      },
      { routing: neo4j.routing.READ },
    ),
  ]);

  const groups: FeedbackAggregateGroup[] = aggregateResult.records.map(
    (record) => ({
      rating: record.get("rating"),
      reason: record.get("reason"),
      count: numberValue(record.get("count")),
    }),
  );
  const recent = recentResult.records.flatMap((record): AdminFeedbackEntry[] => {
    const fromQid = textValue(record.get("fromQid"));
    const toQid = textValue(record.get("toQid"));
    const rating = record.get("rating");
    const rawReason = record.get("reason");
    const reasonValue =
      typeof rawReason === "string" &&
      PATH_FEEDBACK_REASONS.includes(rawReason as PathFeedbackReason)
        ? (rawReason as PathFeedbackReason)
        : null;

    if (!isValidQid(fromQid) || !isValidQid(toQid) || !isPathFeedbackRating(rating)) {
      return [];
    }

    return [
      {
        id: textValue(record.get("id")),
        timestamp: timestampValue(record.get("timestamp")),
        fromQid,
        fromName: optionalTextValue(record.get("fromName")),
        toQid,
        toName: optionalTextValue(record.get("toName")),
        rating,
        reason: rating === "not_really" ? reasonValue : null,
        pathSteps: numberValue(record.get("pathSteps")),
      },
    ];
  });

  return {
    ...summarizeFeedbackGroups(groups),
    recent,
  };
}
