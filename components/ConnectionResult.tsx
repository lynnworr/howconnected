"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ConnectionPath from "@/components/ConnectionPath";
import ConnectionInsights from "@/components/ConnectionInsights";
import FutureAdPlacement from "@/components/FutureAdPlacement";
import PathQualityFeedback from "@/components/PathQualityFeedback";
import ShareableConnectionCard from "@/components/ShareableConnectionCard";
import ShareControls from "@/components/ShareControls";
import type { DiscoveryResult } from "@/components/connection-types";
import type { EditorialPageDetails } from "@/lib/connection-page-state";
import {
  enrichDiscoveryResult,
  parseEntityEnrichmentResponse,
  type EntityImageMap,
  type EntitySourceMap,
} from "@/lib/connection-images";
import {
  markSessionResultViewed,
  trackProductEvent,
} from "@/lib/product-analytics";
import AnalyticsLink from "@/components/AnalyticsLink";
import type { ConnectionOrigin } from "@/lib/connection-attribution";

type ConnectionResultProps = {
  result: DiscoveryResult;
  onReset?: () => void;
  share: {
    sourceName: string;
    targetName: string;
    path: string;
  };
  editorial?: EditorialPageDetails;
  origin?: ConnectionOrigin;
};

export default function ConnectionResult({
  result,
  onReset,
  share,
  editorial,
  origin = onReset ? "homepage" : "shared_url",
}: ConnectionResultProps) {
  const [imageState, setImageState] = useState<{
    key: string;
    images: EntityImageMap;
    sources: EntitySourceMap;
  }>({ key: "", images: {}, sources: {} });
  const primaryQids = useMemo(
    () =>
      result.bestPath
        ? [
            ...new Set(
              result.bestPath.nodes
                .map((node) => node.qid)
                .filter((qid): qid is string => qid !== null),
            ),
          ]
        : [],
    [result.bestPath],
  );
  const primaryQidKey = primaryQids.join(",");
  const images = imageState.key === primaryQidKey ? imageState.images : {};
  const sources = imageState.key === primaryQidKey ? imageState.sources : {};
  const fromQid = result.bestPath?.nodes[0]?.qid ?? "";
  const toQid = result.bestPath?.nodes.at(-1)?.qid ?? "";
  const steps = result.bestPath?.steps ?? 0;
  const alternatePathCount = result.alternatePaths.length;
  const trackedSuccessKey = useRef("");

  useEffect(() => {
    if (!fromQid || !toQid || steps < 1) return;
    const key = `${fromQid}:${toQid}:${steps}`;
    if (trackedSuccessKey.current === key) return;
    trackedSuccessKey.current = key;
    markSessionResultViewed();
    trackProductEvent("search_succeeded", {
      fromQid,
      toQid,
      steps,
      alternatePathCount,
      origin,
    });
  }, [alternatePathCount, fromQid, origin, steps, toQid]);

  useEffect(() => {
    if (primaryQids.length === 0) return;
    const controller = new AbortController();

    async function loadImages() {
      try {
        const params = new URLSearchParams({ qids: primaryQids.join(",") });
        const response = await fetch(`/api/entity-images?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const parsed = parseEntityEnrichmentResponse(await response.json());
        if (parsed) {
          setImageState({
            key: primaryQidKey,
            images: parsed.images,
            sources: parsed.sources,
          });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Entity image enrichment failed", error);
      }
    }

    void loadImages();
    return () => controller.abort();
  }, [primaryQidKey, primaryQids]);

  if (!result.bestPath) return null;
  const enrichedResult = enrichDiscoveryResult(result, images, sources);
  if (!enrichedResult.bestPath) return null;

  return (
    <section
      aria-live="polite"
      className="hc-panel hc-result-panel mx-auto mt-12 w-full max-w-6xl rounded-[28px] border p-4 sm:p-6 md:p-7"
    >
      <div className="mb-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#dff5ec] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#177258]">
          <span className="size-1.5 rounded-full bg-[#22a77b]" />
          {editorial ? "Reviewed connection" : "Connection found"}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-[#15213b] md:text-3xl">
          {editorial ? (
            editorial.headline
          ) : (
            <>
              They&apos;re connected in {enrichedResult.bestPath.steps}{" "}
              {enrichedResult.bestPath.steps === 1 ? "step" : "steps"}.
            </>
          )}
        </h1>
        {editorial ? (
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-[#59647a] sm:text-base sm:leading-7">
            {editorial.introduction}
          </p>
        ) : null}
      </div>

      <ShareableConnectionCard
        sourceName={share.sourceName}
        targetName={share.targetName}
        path={enrichedResult.bestPath}
        images={images}
      />

      <ConnectionInsights path={enrichedResult.bestPath} editorial={editorial} />

      {editorial ? (
        <FutureAdPlacement placement="after-editorial-connection" />
      ) : null}

      {enrichedResult.alternatePaths.length > 0 ? (
        <details
          className="group mx-auto mt-6 max-w-4xl rounded-xl border border-[#e4e6e9] bg-white/65"
          onToggle={(event) => {
            if (event.currentTarget.open) {
              trackProductEvent("alternate_paths_opened", {
                fromQid,
                toQid,
                alternatePathCount,
              });
            }
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-bold text-[#26334f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">
            See other connections
            <span className="text-[#ee6243] transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="space-y-7 border-t border-[#eceef1] px-5 py-6">
            {enrichedResult.alternatePaths.slice(0, 2).map((path, index) => (
              <div key={`${path.steps}-${index}`}>
                <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-[#8a91a0]">
                  Alternate {index + 1}
                </p>
                <ConnectionPath path={path} compact />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <PathQualityFeedback
        fromQid={fromQid}
        toQid={toQid}
        pathSteps={enrichedResult.bestPath.steps}
      />

      <ShareControls
        fromQid={fromQid}
        toQid={toQid}
        sourceName={share.sourceName}
        targetName={share.targetName}
        steps={enrichedResult.bestPath.steps}
        path={share.path}
        origin={origin}
      />

      <div className="mt-7 border-t border-[#e4e6e9] pt-6 text-center">
        <h3 className="text-lg font-bold text-[#192541]">Where will the next thread lead?</h3>
        <p className="mt-1 text-sm text-[#6f7889]">Pick two more people, places, or ideas to keep exploring.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="hc-primary-button rounded-full px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#ff6846] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Try another connection
          </button>
        ) : (
          <Link
            href="/"
            onClick={() =>
              trackProductEvent("try_another_clicked", {
                fromQid,
                toQid,
                origin,
              })
            }
            className="hc-primary-button rounded-full px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#ff6846] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Try another connection
          </Link>
        )}
          <AnalyticsLink
            href="/explore"
            event="result_next_action_clicked"
            eventProperties={{ destination: "explore", fromQid, toQid }}
            className="hc-secondary-button inline-flex min-h-10 items-center rounded-full border px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Explore verified paths
          </AnalyticsLink>
          <AnalyticsLink
            href="/#surprise-me"
            event="result_next_action_clicked"
            eventProperties={{ destination: "surprise_me", fromQid, toQid }}
            className="hc-secondary-button inline-flex min-h-10 items-center rounded-full border px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Surprise me
          </AnalyticsLink>
          <AnalyticsLink
            href="/daily"
            event="result_next_action_clicked"
            eventProperties={{ destination: "daily", fromQid, toQid }}
            className="hc-secondary-button inline-flex min-h-10 items-center rounded-full border px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Play The Missing Link
          </AnalyticsLink>
        </div>
      </div>
    </section>
  );
}
