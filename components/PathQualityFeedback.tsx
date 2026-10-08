"use client";

import { useState } from "react";
import type {
  PathFeedbackRating,
  PathFeedbackReason,
} from "@/lib/path-feedback";

type PathQualityFeedbackProps = {
  fromQid: string;
  toQid: string;
  pathSteps: number;
};

const REASONS: Array<{ value: PathFeedbackReason; label: string }> = [
  { value: "too_generic", label: "Too generic" },
  {
    value: "technically_true_but_boring",
    label: "Technically true but boring",
  },
  { value: "relationship_feels_weak", label: "Relationship feels weak" },
  { value: "incorrect", label: "Incorrect" },
  { value: "better_path_exists", label: "Better path exists" },
];

export default function PathQualityFeedback({
  fromQid,
  toQid,
  pathSteps,
}: PathQualityFeedbackProps) {
  const [showReasons, setShowReasons] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function submit(
    rating: PathFeedbackRating,
    reason: PathFeedbackReason | null,
  ) {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromQid, toQid, rating, reason, pathSteps }),
      });
      if (!response.ok) throw new Error(`Feedback returned ${response.status}`);
      setStatus("sent");
    } catch (error: unknown) {
      console.error("Could not submit path feedback", error);
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="mt-6 text-center text-sm font-semibold text-[#177258]" role="status">
        Thanks for the feedback.
      </p>
    );
  }

  const buttonClass =
    "rounded-full border border-[#d8dce3] bg-white px-3.5 py-1.5 text-xs font-bold text-[#4f596d] transition hover:border-[#ff9b84] hover:text-[#b9462f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] disabled:opacity-50";

  return (
    <div className="mx-auto mt-6 max-w-2xl border-t border-[#e7e9ed] pt-5 text-center">
      <p className="text-sm font-semibold text-[#596276]">Was this a good connection?</p>
      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={status === "sending"}
          onClick={() => void submit("yes", null)}
        >
          Yes
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={status === "sending"}
          onClick={() => {
            setStatus("idle");
            setShowReasons(true);
          }}
        >
          Not really
        </button>
      </div>

      {showReasons ? (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {REASONS.map((reason) => (
            <button
              key={reason.value}
              type="button"
              className="rounded-full bg-[#f2f3f5] px-3 py-1.5 text-[11px] font-semibold text-[#626b7d] transition hover:bg-[#fff0eb] hover:text-[#a4432d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] disabled:opacity-50"
              disabled={status === "sending"}
              onClick={() => void submit("not_really", reason.value)}
            >
              {reason.label}
            </button>
          ))}
          <button
            type="button"
            className="px-2 py-1.5 text-[11px] font-semibold text-[#7b8495] underline underline-offset-2 disabled:opacity-50"
            disabled={status === "sending"}
            onClick={() => void submit("not_really", null)}
          >
            Skip reason
          </button>
        </div>
      ) : null}

      {status === "error" ? (
        <p className="mt-2 text-xs font-semibold text-[#a4432d]" role="status">
          Feedback could not be saved. Please try again.
        </p>
      ) : null}
    </div>
  );
}
