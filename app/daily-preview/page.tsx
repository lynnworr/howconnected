import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import DailyChallenge from "@/components/DailyChallenge";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { getUtcDateKey } from "@/lib/daily-puzzles";
import type { DailyAnswerReveal, PublicDailyPuzzle } from "@/lib/daily-answer-types";

export const instant = false;
export const metadata: Metadata = { title: "Daily Challenge Preview | HowConnected", description: "Preview The Missing Link and the experimental Guess the Connection format.", alternates: { canonical: "/daily" }, robots: { index: false, follow: true } };

const syntheticPuzzle: PublicDailyPuzzle = {
  id: "synthetic-preview-only",
  title: "A fictional preview path",
  prompt: "Who is the fictional missing link between Aurora Atlas and Harbor Observatory?",
  category: "Science and innovation",
  hiddenNodeIndex: 1,
  path: [
    { slotId: "preview-source", hidden: false, qid: "Q1", name: "Aurora Atlas" },
    { slotId: "preview-hidden", hidden: true },
    { slotId: "preview-target", hidden: false, qid: "Q2", name: "Harbor Observatory" },
  ],
  options: [
    { id: "mira-sol", label: "Mira Sol" },
    { id: "orion-vale", label: "Orion Vale" },
    { id: "lena-crest", label: "Lena Crest" },
    { id: "atlas-reed", label: "Atlas Reed" },
  ],
};

const syntheticReveal: Omit<DailyAnswerReveal, "correct" | "selectedOptionId"> = {
  path: [
    { qid: "Q1", name: "Aurora Atlas", wikidataUrl: "https://example.com/aurora-atlas", wikipediaUrl: "https://example.com/aurora-atlas" },
    { qid: "Q3", name: "Mira Sol", wikidataUrl: "https://example.com/mira-sol", wikipediaUrl: "https://example.com/mira-sol" },
    { qid: "Q2", name: "Harbor Observatory", wikidataUrl: "https://example.com/harbor-observatory", wikipediaUrl: "https://example.com/harbor-observatory" },
  ],
  relationships: [
    { propertyId: "P1", subjectQid: "Q1", objectQid: "Q3", direction: "forward", label: "fictionally catalogued by", qualifiers: [], expectedClaim: "Synthetic preview relationship", evidence: [{ label: "Synthetic preview evidence", publisher: "HowConnected demonstration", url: "https://example.com/preview-evidence-1", kind: "supporting" }] },
    { propertyId: "P2", subjectQid: "Q3", objectQid: "Q2", direction: "forward", label: "fictionally worked at", qualifiers: [], expectedClaim: "Synthetic preview relationship", evidence: [{ label: "Synthetic preview evidence", publisher: "HowConnected demonstration", url: "https://example.com/preview-evidence-2", kind: "supporting" }] },
  ],
  explanation: "This fictional example demonstrates the answer and evidence experience without using any scheduled Daily Challenge content.",
  recommendations: [],
};

export default async function DailyPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();
  const now = new Date();
  return <main className="hc-public relative min-h-screen overflow-hidden"><NetworkBackdrop /><div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-14 pt-5 sm:px-7 lg:px-10"><PublicHeader />
    <article className="mx-auto w-full flex-1 py-12 sm:py-16"><header className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">Private product preview</p><h1 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] text-[#15213b] sm:text-6xl">The Missing Link</h1><p className="mx-auto mt-4 max-w-2xl text-lg text-[#657087]">A HowConnected Daily Challenge</p></header>
      <div className="mt-10"><DailyChallenge dateKey={getUtcDateKey(now)} puzzle={syntheticPuzzle} preview previewAnswer={{ correctOptionId: "mira-sol", reveal: syntheticReveal }} /></div>
    </article><PublicFooter /></div></main>;
}
