"use client";

import Link from "next/link";
import { useState } from "react";
import { getConnectionPath } from "@/lib/connection-share";
import { trackProductEvent } from "@/lib/product-analytics";
import { pickSurprisePair, SURPRISE_PAIRS } from "@/lib/surprise-pairs";

const RECENT_KEY = "howconnected:recent-surprises";

function recentPairIds(): string[] {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(-3)
      : [];
  } catch {
    return [];
  }
}

export default function SurpriseMe() {
  const [pair, setPair] = useState(SURPRISE_PAIRS[0]);

  function shuffle() {
    const recent = recentPairIds();
    const next = pickSurprisePair(pair.id, recent, Math.random());
    setPair(next);
    try {
      window.sessionStorage.setItem(
        RECENT_KEY,
        JSON.stringify([...recent, next.id].slice(-3)),
      );
    } catch {
      // Repetition avoidance is best-effort when storage is unavailable.
    }
  }

  return (
    <aside className="hc-surprise mx-auto mt-8 w-full max-w-3xl rounded-2xl border px-4 py-4 text-left sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-5">
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#ee6243]">
          Surprise me
        </p>
        <p className="mt-1 text-balance text-sm font-bold text-[#26334f] sm:text-base">
          {pair.from.label} <span aria-hidden="true" className="text-[#ff6846]">↔</span> {pair.to.label}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#70798b]">{pair.hook}</p>
      </div>
      <div className="mt-4 flex shrink-0 items-center gap-2 sm:mt-0">
        <button
          type="button"
          onClick={shuffle}
          className="hc-secondary-button min-h-11 rounded-full border px-4 text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          aria-label="Show another surprise pair"
        >
          Another
        </button>
        <Link
          href={getConnectionPath(pair.from.id, pair.to.id)}
          onClick={() =>
            trackProductEvent("surprise_me_used", {
              pairId: pair.id,
              fromQid: pair.from.id,
              toQid: pair.to.id,
            })
          }
          className="hc-primary-button inline-flex min-h-11 items-center rounded-full px-5 text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
        >
          Explore <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </div>
    </aside>
  );
}
