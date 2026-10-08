"use client";

import { useEffect, useRef } from "react";
import {
  trackProductEvent,
  type ProductEventName,
} from "@/lib/product-analytics";

type ConnectionOutcomeAnalyticsProps = {
  event: Extract<ProductEventName, "connection_no_result" | "connection_error">;
  fromQid: string;
  toQid: string;
  origin: "homepage" | "shared_url";
};

export default function ConnectionOutcomeAnalytics({
  event,
  fromQid,
  toQid,
  origin,
}: ConnectionOutcomeAnalyticsProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackProductEvent(event, { fromQid, toQid, origin });
  }, [event, fromQid, origin, toQid]);

  return null;
}
