"use client";

import { track } from "@vercel/analytics";
import { sanitizeProductEvent, type ProductEventName, type ProductEventProperties } from "@/lib/product-analytics-schema";
export type { ProductEventName } from "@/lib/product-analytics-schema";

const SESSION_CONNECTION_COUNT_KEY = "connections-lab:connection-count";
const SESSION_RESULT_VIEWED_KEY = "connections-lab:result-viewed";

export function trackProductEvent(
  name: ProductEventName,
  properties: ProductEventProperties = {},
) {
  try {
    const sanitized = sanitizeProductEvent(name, properties);
    if (sanitized) track(name, sanitized);
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
