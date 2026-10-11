"use client";

import { useEffect, useRef } from "react";
import {
  trackProductEvent,
  type ProductEventName,
} from "@/lib/product-analytics";
import type { DiscoveryFailureCategory } from "@/lib/discovery-failure-category";
import type { ConnectionOrigin } from "@/lib/connection-attribution";

type ConnectionOutcomeAnalyticsProps = {
  event: Extract<
    ProductEventName,
    "search_no_reliable_path" | "search_timed_out" | "search_failed"
  >;
  fromQid: string;
  toQid: string;
  origin: ConnectionOrigin;
  failureCategory?: DiscoveryFailureCategory;
};

export default function ConnectionOutcomeAnalytics({
  event,
  fromQid,
  toQid,
  origin,
  failureCategory,
}: ConnectionOutcomeAnalyticsProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackProductEvent(event, { fromQid, toQid, origin, failureCategory });
  }, [event, failureCategory, fromQid, origin, toQid]);

  return null;
}
