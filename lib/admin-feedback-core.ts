import {
  PATH_FEEDBACK_RATINGS,
  PATH_FEEDBACK_REASONS,
  type PathFeedbackRating,
  type PathFeedbackReason,
} from "./path-feedback.ts";

export const ADMIN_FEEDBACK_FILTERS = ["all", "positive", "negative"] as const;

export type AdminFeedbackFilter = (typeof ADMIN_FEEDBACK_FILTERS)[number];

export const PATH_FEEDBACK_REASON_LABELS: Readonly<
  Record<PathFeedbackReason, string>
> = {
  too_generic: "Too generic",
  technically_true_but_boring: "Technically true but boring",
  relationship_feels_weak: "Relationship feels weak",
  incorrect: "Incorrect",
  better_path_exists: "Better path exists",
};

export type FeedbackAggregateGroup = {
  rating: unknown;
  reason: unknown;
  count: unknown;
};

export type NegativeReasonCount = {
  reason: PathFeedbackReason;
  label: string;
  count: number;
};

export type AdminFeedbackSummary = {
  total: number;
  positive: number;
  negative: number;
  positivePercentage: number;
};

export type AdminFeedbackEntry = {
  id: string;
  timestamp: string;
  fromQid: string;
  fromName: string | null;
  toQid: string;
  toName: string | null;
  rating: PathFeedbackRating;
  reason: PathFeedbackReason | null;
  pathSteps: number;
};

export type AdminFeedbackDashboard = {
  summary: AdminFeedbackSummary;
  negativeReasons: NegativeReasonCount[];
  recent: AdminFeedbackEntry[];
};

function normalizedCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function summarizeFeedbackGroups(
  groups: readonly FeedbackAggregateGroup[],
): Pick<AdminFeedbackDashboard, "summary" | "negativeReasons"> {
  let positive = 0;
  let negative = 0;
  const reasonCounts = new Map<PathFeedbackReason, number>();

  for (const group of groups) {
    const count = normalizedCount(group.count);
    if (group.rating === "yes") positive += count;
    if (group.rating === "not_really") {
      negative += count;
      if (
        typeof group.reason === "string" &&
        PATH_FEEDBACK_REASONS.includes(group.reason as PathFeedbackReason)
      ) {
        const reason = group.reason as PathFeedbackReason;
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + count);
      }
    }
  }

  const total = positive + negative;
  const negativeReasons = PATH_FEEDBACK_REASONS.map((reason) => ({
    reason,
    label: PATH_FEEDBACK_REASON_LABELS[reason],
    count: reasonCounts.get(reason) ?? 0,
  })).sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );

  return {
    summary: {
      total,
      positive,
      negative,
      positivePercentage:
        total === 0 ? 0 : Math.round((positive / total) * 1_000) / 10,
    },
    negativeReasons,
  };
}

export function parseAdminFeedbackFilter(
  value: string | string[] | undefined,
): AdminFeedbackFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ADMIN_FEEDBACK_FILTERS.includes(candidate as AdminFeedbackFilter)
    ? (candidate as AdminFeedbackFilter)
    : "all";
}

export function parseAdminFeedbackReason(
  value: string | string[] | undefined,
): PathFeedbackReason | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PATH_FEEDBACK_REASONS.includes(candidate as PathFeedbackReason)
    ? (candidate as PathFeedbackReason)
    : null;
}

export function isPathFeedbackRating(
  value: unknown,
): value is PathFeedbackRating {
  return PATH_FEEDBACK_RATINGS.includes(value as PathFeedbackRating);
}
