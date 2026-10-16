"use client";

import { useEffect, useState } from "react";
import AnalyticsLink from "@/components/AnalyticsLink";
import { CHROME_WEB_STORE_URL } from "@/lib/external-links";

const SESSION_PROMOTION_KEY = "howconnected:extension-promotion-shown";

export default function ContextualExtensionCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let shouldShow = true;
    try {
      shouldShow = !window.sessionStorage.getItem(SESSION_PROMOTION_KEY);
      if (shouldShow) window.sessionStorage.setItem(SESSION_PROMOTION_KEY, "1");
    } catch {
      // A blocked storage API should not prevent the contextual link from working.
    }
    if (!shouldShow) return;
    const timer = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-5 text-[#7b8495]">
      Follow connections while reading Wikipedia with the{" "}
      <AnalyticsLink
        href={CHROME_WEB_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        event="extension_install_clicked"
        eventProperties={{ extensionPlacement: "connection_result" }}
        className="rounded-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
      >
        HowConnected Chrome extension
        <span className="sr-only"> (opens the Chrome Web Store in a new tab)</span>
      </AnalyticsLink>
      .
    </p>
  );
}
