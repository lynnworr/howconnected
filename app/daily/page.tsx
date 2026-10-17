import type { Metadata } from "next";
import { connection } from "next/server";
import DailyChallenge from "@/components/DailyChallenge";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { getDailyOrigin } from "@/lib/connection-attribution";
import { getContentRunwayReport, getDailyScheduleState, getSafeDailyRequestDate, getUtcDateKey, isDailyPubliclyLaunched, MISSING_LINK_PUZZLES } from "@/lib/daily-puzzles";
import { toPublicDailyPuzzle } from "@/lib/daily-answer-types";

export const instant = false;
const runway = getContentRunwayReport();
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return {
    title: "The Missing Link — A HowConnected Daily Challenge",
    description: "Find the hidden entity in a verified relationship path, then explore the connection and its evidence.",
    alternates: { canonical: "/daily" }, robots: { index: isDailyPubliclyLaunched(), follow: true },
    openGraph: { title: "The Missing Link — A HowConnected Daily Challenge", description: "Can you find the missing link?", url: "/daily", type: "website" },
    twitter: { card: "summary_large_image", title: "The Missing Link", description: "A verified daily connection challenge from HowConnected." },
  };
}

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ date?: string | string[]; source?: string | string[] }> }) {
  await connection();
  const query = await searchParams;
  const requested = query.date;
  const origin = getDailyOrigin(query.source);
  const now = new Date();
  const requestedDate = getSafeDailyRequestDate(typeof requested === "string" ? requested : undefined, now);
  const state = getDailyScheduleState(requestedDate);
  const publiclyLaunched = isDailyPubliclyLaunched(now);
  const previewPuzzle = MISSING_LINK_PUZZLES.find((puzzle) => ["approved", "scheduled", "published"].includes(puzzle.status));
  const playable = state.kind === "available" || state.kind === "preview" ? state : null;
  const publicPuzzle = playable ? toPublicDailyPuzzle(playable.puzzle) : null;
  return <main className="hc-public relative min-h-screen overflow-hidden"><NetworkBackdrop />
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-14 pt-5 sm:px-7 lg:px-10"><PublicHeader />
      <article className="mx-auto w-full flex-1 py-12 sm:py-16"><header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">The Missing Link</p>
        <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] text-[#15213b] sm:text-6xl">A HowConnected Daily Challenge</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#657087] sm:text-lg">Two endpoints. One hidden connection. Choose the missing link, then follow the verified path into Wikipedia and the supporting evidence.</p>
        {!publiclyLaunched ? <p className="mx-auto mt-5 inline-flex rounded-full border border-[#e2b9ae] bg-[#fff4ef] px-4 py-2 text-xs font-bold text-[#8d3b2a]">Launch preparation · {runway.scheduledCount} reviewed puzzles scheduled</p> : null}
      </header>
      <div className="mt-10">{playable && publicPuzzle ? <DailyChallenge dateKey={state.kind === "available" ? state.dateKey : getUtcDateKey(requestedDate)} puzzle={publicPuzzle} puzzleNumber={state.kind === "available" ? state.puzzleNumber : undefined} preview={state.kind === "preview"} origin={origin} />
        : <section className="hc-daily-card rounded-[24px] border p-7 text-center"><h2 className="text-2xl font-bold text-[#1d2944]">{state.kind === "before-launch" ? "The challenge has not launched yet." : state.kind === "exhausted" ? "Today's puzzle is not available." : "This scheduled puzzle is temporarily unavailable."}</h2>
          <p className="mt-3 text-sm leading-6 text-[#657087]">{state.kind === "before-launch" ? `Launch date: ${state.launchDate}.` : state.kind === "exhausted" ? "The reviewed schedule has ended; no unreviewed puzzle will be substituted or recycled." : "A quarantined, retired, or missing entry is never replaced automatically."}</p></section>}</div>
      {!playable && previewPuzzle && process.env.NODE_ENV !== "production" ? <p className="mt-5 text-center text-sm text-[#657087]">A synthetic development preview is available at <a className="font-bold underline" href="/daily-preview">/daily-preview</a>.</p> : null}
      </article><PublicFooter /></div></main>;
}
