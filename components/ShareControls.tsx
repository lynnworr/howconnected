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
    try {
      await copyText(absoluteUrl());
      trackProductEvent("result_shared", {
        fromQid,
        toQid,
        steps,
        method: "copy_link",
      });
      setFeedback("Link copied");
    } catch (error: unknown) {
      console.error("Could not copy connection link", error);
      setFeedback("Could not copy link");
    }
  }

  async function share() {
    const url = absoluteUrl();

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
      if (outcome === "shared" || outcome === "copied") {
        trackProductEvent("result_shared", {
          fromQid,
          toQid,
          steps,
          method: outcome === "copied" ? "share_fallback_copy" : "native_share",
        });
      }
      if (outcome === "copied") setFeedback("Link copied");
      if (outcome === "shared") setFeedback("Shared");
      if (outcome === "unavailable") setFeedback("Sharing unavailable");
    } catch (error: unknown) {
      console.error("Could not share connection", error);
      setFeedback("Could not copy link");
    }
  }

  const buttonClass =
    "hc-secondary-button min-h-10 rounded-full border px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]";

  return (
    <div className="mx-auto mt-7 flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#e4e6e9] bg-white/55 px-4 py-4">
      <p className="w-full text-center text-sm font-semibold text-[#46516a]">
        Know someone who would enjoy this connection?
      </p>
      <button type="button" onClick={copyLink} className={buttonClass}>
        Copy link
      </button>
      <button type="button" onClick={share} className={buttonClass}>
        Share
      </button>
      <span className="min-h-4 w-full text-center text-xs font-semibold text-[#6f7889]" role="status" aria-live="polite">
        {feedback}
      </span>
    </div>
  );
}
