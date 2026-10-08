"use client";

import { track } from "@vercel/analytics";

export type ProductEventName =
  | "entity_search"
  | "connection_submit"
  | "connection_success"
  | "connection_no_result"
  | "connection_error"
  | "alternate_paths_opened"
  | "share_clicked"
  | "copy_link_clicked"
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
  track(name, properties);
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
