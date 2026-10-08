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
import {
  enrichDiscoveryResult,
  parseEntityEnrichmentResponse,
  type EntityImageMap,
  type EntitySourceMap,
} from "@/lib/connection-images";
import { trackProductEvent } from "@/lib/product-analytics";

type ConnectionResultProps = {
  result: DiscoveryResult;
  onReset?: () => void;
  share: {
    sourceName: string;
    targetName: string;
    path: string;
  };
};

export default function ConnectionResult({
  result,
  onReset,
  share,
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
    trackProductEvent("connection_success", {
      fromQid,
      toQid,
      steps,
      alternatePathCount,
      origin: onReset ? "homepage" : "shared_url",
    });
  }, [alternatePathCount, fromQid, onReset, steps, toQid]);

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
      className="mx-auto mt-12 w-full max-w-6xl rounded-[28px] border border-[#e2e5ea] bg-[#fbfaf7]/95 p-5 shadow-[0_24px_80px_rgba(20,30,50,0.09)] md:p-9"
    >
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#dff5ec] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#177258]">
          <span className="size-1.5 rounded-full bg-[#22a77b]" />
          Connection found
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[#15213b] md:text-3xl">
          They&apos;re connected in {enrichedResult.bestPath.steps}{" "}
          {enrichedResult.bestPath.steps === 1 ? "step" : "steps"}.
        </h2>
      </div>

      <ShareableConnectionCard
        sourceName={share.sourceName}
        targetName={share.targetName}
        path={enrichedResult.bestPath}
        images={images}
      />

      <ConnectionInsights path={enrichedResult.bestPath} />

      <FutureAdPlacement placement="after-connection-content" />

      <ShareControls
        fromQid={fromQid}
        toQid={toQid}
        sourceName={share.sourceName}
        targetName={share.targetName}
        steps={enrichedResult.bestPath.steps}
        path={share.path}
      />

      {enrichedResult.alternatePaths.length > 0 ? (
        <details
          className="group mx-auto mt-8 max-w-4xl rounded-2xl border border-[#e1e4e9] bg-white"
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

      <div className="mt-8 flex justify-center">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-[#cfd5df] bg-white px-5 py-2.5 text-sm font-bold text-[#26334f] transition hover:-translate-y-0.5 hover:border-[#ff8a70] hover:text-[#c9472d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
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
                origin: "shared_url",
              })
            }
            className="rounded-full border border-[#cfd5df] bg-white px-5 py-2.5 text-sm font-bold text-[#26334f] transition hover:-translate-y-0.5 hover:border-[#ff8a70] hover:text-[#c9472d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Try another connection
          </Link>
        )}
      </div>
    </section>
  );
}
