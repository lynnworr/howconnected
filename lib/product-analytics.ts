"use client";

import { track } from "@vercel/analytics";

export type ProductEventName =
  | "entity_lookup_completed"
  | "search_initiated"
  | "search_succeeded"
  | "search_no_reliable_path"
  | "search_timed_out"
  | "search_failed"
  | "alternate_paths_opened"
  | "result_shared"
  | "surprise_me_used"
  | "entity_source_opened"
  | "try_another_clicked"
  | "additional_search_started"
  | "surprise_me_shuffled"
  | "explore_connection_opened"
  | "explore_category_selected"
  | "related_connection_opened"
  | "result_next_action_clicked"
  | "extension_referral_opened";

type ProductEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const SESSION_CONNECTION_COUNT_KEY = "connections-lab:connection-count";
const SESSION_RESULT_VIEWED_KEY = "connections-lab:result-viewed";

export function trackProductEvent(
  name: ProductEventName,
  properties: ProductEventProperties = {},
) {
  try {
    track(name, properties);
  } catch {
    // Analytics must never block or break the product experience.
  }
}

export function incrementSessionConnectionCount(): number {
  try {
    const current = Number.parseInt(
      window.sessionStorage.getItem(SESSION_CONNECTION_COUNT_KEY) ?? "0",
      10,
    );
    const next = (Number.isFinite(current) ? current : 0) + 1;
    window.sessionStorage.setItem(SESSION_CONNECTION_COUNT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function markSessionResultViewed() {
  try {
    window.sessionStorage.setItem(SESSION_RESULT_VIEWED_KEY, "1");
  } catch {
    // Repeat-use measurement is best-effort when session storage is unavailable.
  }
}

export function hasViewedResultInSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_RESULT_VIEWED_KEY) === "1";
  } catch {
    return false;
  }
}
