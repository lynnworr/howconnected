import type { Metadata } from "next";
import { connection } from "next/server";
import DailyChallenge from "@/components/DailyChallenge";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { getComparisonPuzzle, getDailyPuzzleForDate, getUtcDateKey } from "@/lib/daily-puzzles";

export const instant = false;
export const metadata: Metadata = { title: "Daily Challenge Preview | HowConnected", description: "Preview The Missing Link and the experimental Guess the Connection format.", alternates: { canonical: "/daily" }, robots: { index: false, follow: true } };
export default async function DailyPreviewPage() {
  await connection(); const now = new Date(); const puzzle = getDailyPuzzleForDate(now); const comparison = getComparisonPuzzle();
  return <main className="hc-public relative min-h-screen overflow-hidden"><NetworkBackdrop /><div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-14 pt-5 sm:px-7 lg:px-10"><PublicHeader />
    <article className="mx-auto w-full flex-1 py-12 sm:py-16"><header className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">Private product preview</p><h1 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] text-[#15213b] sm:text-6xl">The Missing Link</h1><p className="mx-auto mt-4 max-w-2xl text-lg text-[#657087]">A HowConnected Daily Challenge</p></header>
      <div className="mt-10"><DailyChallenge dateKey={getUtcDateKey(now)} puzzle={puzzle} preview /></div>
      <details className="hc-daily-comparison mt-8 rounded-[24px] border p-5 sm:p-7"><summary className="cursor-pointer text-lg font-bold text-[#1d2944]">Experimental: Guess the Connection</summary><p className="mt-3 text-sm leading-6 text-[#657087]">This secondary format remains outside the daily schedule. {comparison.prompt}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#657087]">{comparison.options.map((option) => <li key={option.id}>{option.label}</li>)}</ul></details>
    </article><PublicFooter /></div></main>;
}
