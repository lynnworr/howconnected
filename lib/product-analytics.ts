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
  | "try_another_clicked";

type ProductEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const SESSION_CONNECTION_COUNT_KEY = "connections-lab:connection-count";

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
