"use client";

import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/product-analytics";

export default function ConnectionReferralAnalytics({
  fromQid,
  toQid,
}: {
  fromQid: string;
  toQid: string;
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackProductEvent("extension_referral_opened", { destination: "connection", fromQid, toQid });
  }, [fromQid, toQid]);

  return null;
}
