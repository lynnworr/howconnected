"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/lib/product-analytics";

const SESSION_KEY = "howconnected:publisher-landing-opened";

export default function PublisherLandingAnalytics() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Page-open measurement remains best-effort when session storage is unavailable.
    }
    trackProductEvent("publisher_landing_opened");
  }, []);

  return null;
}
