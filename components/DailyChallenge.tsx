"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { MissingLinkPuzzle, PuzzleRelationship } from "@/lib/daily-puzzles";
import {
  claimDailyAnalyticsEvent, completeDailyChallenge, DAILY_COMPLETION_STORAGE_KEY,
  getDailyResult, getVisibleCurrentStreak, LEGACY_DAILY_COMPLETION_STORAGE_KEY, parseDailyCompletionState, type DailyCompletionState,
} from "@/lib/daily-challenge-state";
import { trackProductEvent } from "@/lib/product-analytics";

type Props = { dateKey: string; puzzle: MissingLinkPuzzle; puzzleNumber?: number; preview?: boolean };
function subscribe(onChange: () => void) { window.addEventListener("storage", onChange); return () => window.removeEventListener("storage", onChange); }
function snapshot() {
  try { return window.localStorage.getItem(DAILY_COMPLETION_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_DAILY_COMPLETION_STORAGE_KEY) ?? ""; } catch { return ""; }
}
function serverSnapshot() { return ""; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function relationshipDetail(item: PuzzleRelationship) {
  const qualifiers = item.qualifiers.length ? ` (${item.qualifiers.map((qualifier) => `${qualifier.label}: ${qualifier.value}`).join("; ")})` : "";
  return `${item.label}${qualifiers}`;
}
function externalLabel(label: string) { return <>{label} <span className="sr-only">(opens in a new tab)</span><span aria-hidden="true">↗</span></>; }

export default function DailyChallenge({ dateKey, puzzle, puzzleNumber, preview = false }: Props) {
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const persisted = useMemo(() => parseDailyCompletionState(stored), [stored]);
  const [override, setOverride] = useState<DailyCompletionState | null>(null);
  const state = override ?? persisted;
  const prior = getDailyResult(state, dateKey, puzzle.id);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const opened = useRef(false);
  const effectiveSelected = prior?.selectedOptionId ?? selected;
  const correct = effectiveSelected === puzzle.correctOptionId;
  useEffect(() => {
    if (!opened.current && claimDailyAnalyticsEvent(window.sessionStorage, "opened", dateKey, puzzle.id)) {
      opened.current = true;
      trackProductEvent("daily_challenge_opened", { puzzleId: puzzle.id, category: puzzle.category, utcDate: dateKey });
    }
  }, [dateKey, puzzle.category, puzzle.id]);
  useEffect(() => {
    const delay = Date.parse(`${dateKey}T00:00:00Z`) + 86_400_000 - Date.now();
    if (delay <= 0 || delay > 86_400_000) return;
    const timer = window.setTimeout(() => window.location.reload(), delay + 1_000);
    return () => window.clearTimeout(timer);
  }, [dateKey]);

  function claim(event: string) { return claimDailyAnalyticsEvent(window.sessionStorage, event, dateKey, puzzle.id); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || submitted || prior) return;
    const isCorrect = selected === puzzle.correctOptionId; setSubmitted(true);
    if (claim("answer-submitted")) trackProductEvent("daily_challenge_answer_submitted", { puzzleId: puzzle.id, category: puzzle.category, isCorrect });
    const completion = completeDailyChallenge(state, { dateKey, puzzleId: puzzle.id, correct: isCorrect, selectedOptionId: selected });
    try { window.localStorage.setItem(DAILY_COMPLETION_STORAGE_KEY, JSON.stringify(completion.state)); } catch { /* Local progress is best-effort. */ }
    setOverride(completion.state);
    if (completion.newlyCompleted && claim("completed")) trackProductEvent("daily_challenge_completed", { puzzleId: puzzle.id, category: puzzle.category, isCorrect });
  }
  function trackLink(kind: "wikipedia" | "evidence", target: string) {
    const event = kind === "wikipedia" ? "daily_wikipedia_link_clicked" : "daily_evidence_link_clicked";
    if (claim(`${kind}:${target}`)) trackProductEvent(event, { puzzleId: puzzle.id, category: puzzle.category, linkType: kind });
  }
  async function share() {
    const number = puzzleNumber ? ` #${puzzleNumber}` : "";
    const text = `The Missing Link — Daily Challenge${number}\n\nI solved today's connection!\n\nCan you find the missing link?`;
    const url = new URL("/daily", window.location.origin).toString(); let method = "native_share";
    try {
      if (navigator.share) await navigator.share({ title: "The Missing Link", text, url });
      else if (navigator.clipboard) { method = "clipboard"; await navigator.clipboard.writeText(`${text}\n\n${url}`); }
      else { setShareFeedback("Sharing is unavailable in this browser."); return; }
      setShareFeedback(method === "clipboard" ? "Spoiler-free result copied." : "Shared.");
      if (claim(`shared:${method}`)) trackProductEvent("daily_challenge_result_shared", { puzzleId: puzzle.id, category: puzzle.category, method });
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setShareFeedback("Could not share this time."); }
  }

  const revealed = submitted || Boolean(prior);
  return <div>
    <section className="hc-daily-progress mb-5 grid gap-4 rounded-2xl border px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#a4432d]">{formatDate(dateKey)} · UTC{preview ? " · Preview" : ""}</p>
        <p className="mt-1 text-sm font-semibold text-[#37435c]">{prior ? "Completed on this browser — revisit the explanation anytime." : "One scored answer. Take your time."}</p></div>
      <div className="flex gap-5 text-sm text-[#657087]" aria-label="Progress stored only in this browser">
        <span><strong className="text-[#1d2944]">{getVisibleCurrentStreak(state, dateKey)}</strong> current streak</span><span><strong className="text-[#1d2944]">{state.bestStreak}</strong> best</span>
      </div>
    </section>

    <section className="hc-daily-card rounded-[24px] border p-5 sm:p-8" aria-labelledby={`${puzzle.id}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a4432d]">{puzzle.category}</p>
        <span className="rounded-full border border-[#dfe2e5] px-3 py-1 text-[11px] font-bold text-[#657087]">{puzzleNumber ? `Challenge #${puzzleNumber}` : "Reviewed preview"}</span></div>
      <h2 id={`${puzzle.id}-heading`} className="mt-4 text-balance text-2xl font-extrabold tracking-[-0.035em] text-[#1d2944] sm:text-3xl">{puzzle.prompt}</h2>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2" aria-label={revealed ? "Complete revealed connection path" : `Incomplete connection from ${puzzle.path[0].name} to ${puzzle.path.at(-1)?.name}`}>
        {puzzle.path.map((node, index) => <div className="contents" key={node.qid}>
          {index > 0 ? <span className="max-w-44 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#a4432d]">{revealed ? relationshipDetail(puzzle.relationships[index - 1]) : <span aria-hidden="true">— ? —</span>}</span> : null}
          <span className={`hc-daily-node rounded-full border px-4 py-2 text-sm font-bold ${index === puzzle.hiddenNodeIndex && !revealed ? "border-dashed text-2xl" : ""}`}>
            {index === puzzle.hiddenNodeIndex && !revealed ? <><span aria-hidden="true">?</span><span className="sr-only">Hidden middle entity</span></> : node.name}
          </span></div>)}
      </div>
      <p className="mt-6 text-center text-sm font-bold text-[#37435c]">Who or what is the missing link?</p>
      <form className="mt-4" onSubmit={submit}><fieldset disabled={revealed}><legend className="sr-only">Choose one answer</legend>
        <div className="grid gap-3 sm:grid-cols-2">{puzzle.options.map((option) => <label key={option.id} className={`hc-daily-option flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${selected === option.id ? "hc-daily-option-selected" : ""}`}>
          <input type="radio" name={`${puzzle.id}-answer`} value={option.id} checked={effectiveSelected === option.id} onChange={() => setSelected(option.id)} className="size-4 accent-[#ee6243]"/><span>{option.label}</span></label>)}</div>
      </fieldset><button type="submit" disabled={!selected || revealed} className="hc-primary-button mt-5 min-h-11 rounded-full px-6 text-sm font-bold transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]">Submit answer</button></form>

      {revealed ? <div className="hc-daily-reveal mt-7 rounded-2xl border px-5 py-6" aria-live="polite">
        <p role="status" className={`text-base font-extrabold ${correct ? "text-[#177258]" : "text-[#a4432d]"}`}>{correct ? "You found the missing link." : `The missing link is ${puzzle.path[puzzle.hiddenNodeIndex].name}.`}</p>
        <p className="mt-3 text-sm leading-6 text-[#59647a]">{puzzle.explanation}</p>
        <section className="mt-6" aria-labelledby="explore-connection"><h3 id="explore-connection" className="text-lg font-bold text-[#1d2944]">Explore the connection</h3>
          <p className="mt-1 text-sm leading-6 text-[#657087]">Curious how it all connects? Click the links to read about the people, places, and ideas behind this connection.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">{puzzle.path.map((node, index) => <div className="contents" key={node.qid}>{index ? <span aria-hidden="true" className="text-[#a4432d]">→</span> : null}
            <a href={node.wikipediaUrl ?? node.wikidataUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackLink("wikipedia", node.qid)} className="hc-reading-link rounded-full border px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">{externalLabel(node.name)}</a></div>)}</div>
        </section>
        <section className="mt-7 border-t border-[#dfe2e5]/70 pt-6" aria-labelledby="explore-evidence"><h3 id="explore-evidence" className="text-lg font-bold text-[#1d2944]">Explore the evidence</h3>
          <div className="mt-4 space-y-5">{puzzle.relationships.map((relationship, index) => <article key={`${relationship.propertyId}-${index}`}>
            <p className="text-sm font-bold text-[#37435c]">{puzzle.path[index].name} → {puzzle.path[index + 1].name}</p><p className="mt-1 text-xs text-[#657087]">{relationshipDetail(relationship)} · {relationship.propertyId} · {relationship.direction} direction</p>
            <ul className="mt-2 space-y-1 text-sm text-[#657087]">{relationship.evidence.map((item) => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => trackLink("evidence", `${relationship.propertyId}:${item.kind}`)} className="font-semibold underline underline-offset-3 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">{externalLabel(item.label)}</a> — {item.publisher} <span className="text-xs">({item.kind === "wikidata" ? "structured claim" : "supporting source"})</span></li>)}</ul>
          </article>)}</div>
        </section>
        <div className="mt-7 flex flex-wrap items-center gap-3"><button type="button" onClick={share} className="hc-secondary-button min-h-10 rounded-full border px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">Share spoiler-free result</button>
          <Link href="/explore" onClick={() => trackProductEvent("daily_continued_exploration", { puzzleId: puzzle.id, category: puzzle.category })} className="hc-primary-button inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold">Explore HowConnected</Link><span className="text-xs font-semibold text-[#657087]" aria-live="polite">{shareFeedback}</span></div>
      </div> : null}
    </section>
    <p className="mt-5 text-center text-xs leading-5 text-[#657087]">Progress stays in this browser and does not sync across devices. Skipping a day has no penalty or countdown.</p>
  </div>;
}
