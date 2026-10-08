"use client";

import { useEffect, useState } from "react";
import { shareConnection } from "@/lib/connection-share";
import { trackProductEvent } from "@/lib/product-analytics";

type ShareControlsProps = {
  fromQid: string;
  toQid: string;
  sourceName: string;
  targetName: string;
  steps: number;
  path: string;
};

async function copyText(text: string) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard access is unavailable.");
  }
  await navigator.clipboard.writeText(text);
}

export default function ShareControls({
  fromQid,
  toQid,
  sourceName,
  targetName,
  steps,
  path,
}: ShareControlsProps) {
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function absoluteUrl() {
    return new URL(path, window.location.origin).toString();
  }

  async function copyLink() {
    trackProductEvent("copy_link_clicked", { fromQid, toQid, steps });
    try {
      await copyText(absoluteUrl());
      setFeedback("Link copied");
    } catch (error: unknown) {
      console.error("Could not copy connection link", error);
      setFeedback("Could not copy link");
    }
  }

  async function share() {
    const url = absoluteUrl();
    trackProductEvent("share_clicked", { fromQid, toQid, steps });

    try {
      const outcome = await shareConnection(
        sourceName,
        targetName,
        steps,
        url,
        {
          share: navigator.share
            ? (payload) => navigator.share(payload)
            : undefined,
          writeText: navigator.clipboard
            ? (text) => navigator.clipboard.writeText(text)
            : undefined,
        },
      );
      if (outcome === "copied") setFeedback("Link copied");
      if (outcome === "unavailable") setFeedback("Sharing unavailable");
    } catch (error: unknown) {
      console.error("Could not share connection", error);
      setFeedback("Could not copy link");
    }
  }

  const buttonClass =
    "rounded-full border border-[#cfd5df] bg-white px-4 py-2 text-sm font-bold text-[#26334f] transition hover:-translate-y-0.5 hover:border-[#ff8a70] hover:text-[#c9472d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]";

  return (
    <div className="mt-5 flex min-h-10 flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={copyLink} className={buttonClass}>
        Copy link
      </button>
      <button type="button" onClick={share} className={buttonClass}>
        Share
      </button>
      <span className="w-full text-center text-xs font-semibold text-[#6f7889]" role="status">
        {feedback}
      </span>
    </div>
  );
}
