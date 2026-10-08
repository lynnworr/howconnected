"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ConnectionResult from "@/components/ConnectionResult";
import EntitySearch from "@/components/EntitySearch";
import type { DiscoveryResult, SelectedEntity } from "@/components/connection-types";
import { parseDiscoveryResult } from "@/lib/connection-response";
import { getConnectionPath } from "@/lib/connection-share";
import {
  incrementSessionConnectionCount,
  trackProductEvent,
} from "@/lib/product-analytics";

type SearchSelection = {
  text: string;
  entity: SelectedEntity | null;
};

type ExplorerStatus = "idle" | "loading" | "success" | "empty" | "error";

const LOADING_MESSAGES = [
  "Searching the knowledge graph...",
  "Following meaningful relationships...",
  "Finding the best connection...",
];

const EXAMPLES: Array<{
  from: SelectedEntity;
  to: SelectedEntity;
}> = [
  {
    from: {
      id: "Q19837",
      label: "Steve Jobs",
      description: "American entrepreneur and co-founder of Apple",
    },
    to: {
      id: "Q8704",
      label: "Walt Disney",
      description: "American animator, producer, and entrepreneur",
    },
  },
  {
    from: {
      id: "Q38222",
      label: "George Lucas",
      description: "American filmmaker and philanthropist",
    },
    to: {
      id: "Q19837",
      label: "Steve Jobs",
      description: "American entrepreneur and co-founder of Apple",
    },
  },
  {
    from: {
      id: "Q92764",
      label: "Sergey Brin",
      description: "American billionaire businessman",
    },
    to: {
      id: "Q4934",
      label: "Larry Page",
      description: "American computer scientist and entrepreneur",
    },
  },
];

export default function ConnectionExplorer() {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState<SearchSelection>({ text: "", entity: null });
  const [to, setTo] = useState<SearchSelection>({ text: "", entity: null });
  const [status, setStatus] = useState<ExplorerStatus>("idle");
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const sameEntity = Boolean(
    from.entity && to.entity && from.entity.id === to.entity.id,
  );
  const canSubmit = Boolean(from.entity && to.entity && !sameEntity);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setInterval(() => {
      setLoadingMessageIndex((index) => (index + 1) % LOADING_MESSAGES.length);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [status]);

  function clearOutcome() {
    setStatus("idle");
    setResult(null);
    if (window.location.pathname.startsWith("/connect/")) {
      window.history.replaceState(null, "", "/");
    }
  }

  function updateText(side: "from" | "to", text: string) {
    const setter = side === "from" ? setFrom : setTo;
    setter({ text, entity: null });
    clearOutcome();
  }

  function selectEntity(side: "from" | "to", entity: SelectedEntity) {
    const setter = side === "from" ? setFrom : setTo;
    setter({ text: entity.label, entity });
    clearOutcome();
  }

  function applyExample(fromEntity: SelectedEntity, toEntity: SelectedEntity) {
    setFrom({ text: fromEntity.label, entity: fromEntity });
    setTo({ text: toEntity.label, entity: toEntity });
    clearOutcome();
  }

  function reset() {
    trackProductEvent("try_another_clicked", { origin: "homepage" });
    setFrom({ text: "", entity: null });
    setTo({ text: "", entity: null });
    setResult(null);
    setStatus("idle");
    if (window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
    window.setTimeout(() => firstInputRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from.entity || !to.entity || sameEntity) return;

    setStatus("loading");
    setResult(null);
    setLoadingMessageIndex(0);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    const sessionConnectionNumber = incrementSessionConnectionCount();
    trackProductEvent("connection_submit", {
      fromQid: from.entity.id,
      toQid: to.entity.id,
      sessionConnectionNumber,
    });

    try {
      const params = new URLSearchParams({
        fromQid: from.entity.id,
        toQid: to.entity.id,
      });
      const response = await fetch(`/api/discover?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Discovery returned ${response.status}`);

      const parsed = parseDiscoveryResult(await response.json());
      if (!parsed) throw new Error("Malformed discovery response");

      if (!parsed.found || !parsed.bestPath) {
        trackProductEvent("connection_no_result", {
          fromQid: from.entity.id,
          toQid: to.entity.id,
          origin: "homepage",
          sessionConnectionNumber,
        });
        setStatus("empty");
        return;
      }

      setResult(parsed);
      setStatus("success");
      window.history.pushState(
        { connection: true },
        "",
        getConnectionPath(from.entity.id, to.entity.id),
      );
    } catch (error: unknown) {
      console.error("Connection request failed", error);
      trackProductEvent("connection_error", {
        fromQid: from.entity.id,
        toQid: to.entity.id,
        origin: "homepage",
        sessionConnectionNumber,
      });
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className="mx-auto mt-10 w-full max-w-5xl rounded-[28px] border border-white/80 bg-white/75 p-4 shadow-[0_30px_90px_rgba(19,31,55,0.12)] backdrop-blur-xl md:p-6"
      >
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <EntitySearch
            label="First entity"
            value={from.text}
            selected={from.entity}
            onValueChange={(value) => updateText("from", value)}
            onSelect={(entity) => selectEntity("from", entity)}
            inputRef={firstInputRef}
          />

          <div className="flex shrink-0 items-center justify-center gap-3 py-1 md:w-24 md:flex-col md:gap-1">
            <span className="h-px flex-1 bg-[#d7dce4] md:h-3 md:w-px md:flex-none" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#7b8495]">
              connects to
            </span>
            <span className="h-px flex-1 bg-[#d7dce4] md:h-3 md:w-px md:flex-none" />
          </div>

          <EntitySearch
            label="Second entity"
            value={to.text}
            selected={to.entity}
            onValueChange={(value) => updateText("to", value)}
            onSelect={(entity) => selectEntity("to", entity)}
          />
        </div>

        <div className="mt-5 flex flex-col items-center">
          <button
            type="submit"
            disabled={!canSubmit || status === "loading"}
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17233f] px-7 text-sm font-bold text-white shadow-[0_12px_30px_rgba(23,35,63,0.25)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#ff6846] enabled:hover:shadow-[0_16px_36px_rgba(255,104,70,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Find the connection
            <span aria-hidden="true" className="transition-transform group-enabled:group-hover:translate-x-0.5">
              →
            </span>
          </button>
          {sameEntity ? (
            <p className="mt-2 text-sm font-medium text-[#a4432d]" role="status">
              Choose two different entities to find a connection.
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#8a92a0]">
              Select a suggestion in both fields to continue.
            </p>
          )}
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 text-xs font-semibold text-[#7b8495]">Try an example</span>
        {EXAMPLES.map((example) => (
          <button
            key={`${example.from.id}-${example.to.id}`}
            type="button"
            onClick={() => applyExample(example.from, example.to)}
            className="rounded-full border border-[#d9dee6] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#46516a] transition hover:border-[#ff9b84] hover:bg-white hover:text-[#c9472d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            {example.from.label} <span aria-hidden="true">→</span> {example.to.label}
          </button>
        ))}
      </div>

      {status === "loading" ? (
        <section
          className="mx-auto mt-12 max-w-3xl rounded-[28px] border border-[#e1e5eb] bg-white/80 px-6 py-10 text-center shadow-[0_20px_70px_rgba(20,30,50,0.08)]"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-auto flex w-fit items-center gap-3" aria-hidden="true">
            <span className="size-3 animate-[pulse_1.3s_ease-in-out_infinite] rounded-full bg-[#ff6846]" />
            <span className="size-3 animate-[pulse_1.3s_ease-in-out_0.2s_infinite] rounded-full bg-[#f3b84b]" />
            <span className="size-3 animate-[pulse_1.3s_ease-in-out_0.4s_infinite] rounded-full bg-[#42ad8d]" />
          </div>
          <p className="mt-5 text-base font-bold text-[#24304b]">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>
          <p className="mt-1 text-sm text-[#7b8495]">Some connections take a moment to uncover.</p>
        </section>
      ) : null}

      {status === "success" && result ? (
        <ConnectionResult
          result={result}
          onReset={reset}
          share={{
            sourceName: from.entity?.label ?? "Source",
            targetName: to.entity?.label ?? "Target",
            path: getConnectionPath(
              from.entity?.id ?? "",
              to.entity?.id ?? "",
            ),
          }}
        />
      ) : null}

      {status === "empty" || status === "error" ? (
        <section
          aria-live="polite"
          className="mx-auto mt-12 max-w-xl rounded-[28px] border border-[#eadfd8] bg-[#fffaf6] px-6 py-9 text-center shadow-[0_18px_60px_rgba(30,35,50,0.07)]"
        >
          <span className="text-3xl" aria-hidden="true">⌁</span>
          <h2 className="mt-3 text-xl font-bold text-[#192541]">
            {status === "empty"
              ? "We couldn't find a strong connection yet."
              : "We couldn't complete that search."}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f7889]">
            {status === "empty"
              ? "Try another pair — our knowledge graph is still growing."
              : "Something got in the way. Please try again in a moment."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-full bg-[#17233f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#ff6846] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Try another
          </button>
        </section>
      ) : null}
    </div>
  );
}
