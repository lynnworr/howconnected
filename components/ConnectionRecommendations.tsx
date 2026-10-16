"use client";

import { useEffect, useRef } from "react";
import AnalyticsLink from "@/components/AnalyticsLink";
import type {
  ConnectionRecommendation,
  RecommendationSurface,
} from "@/lib/connection-recommendations";
import { trackProductEvent } from "@/lib/product-analytics";

export default function ConnectionRecommendations({
  recommendations,
  surface,
  sourceConnection,
}: {
  recommendations: readonly ConnectionRecommendation[];
  surface: RecommendationSurface;
  sourceConnection?: string;
}) {
  const impressed = useRef(new Set<string>());

  useEffect(() => {
    for (const recommendation of recommendations) {
      const key = `${surface}:${recommendation.slug}`;
      if (impressed.current.has(key)) continue;
      impressed.current.add(key);
      trackProductEvent("recommended_connection_impression", {
        connection: recommendation.slug,
        recommendationSurface: surface,
        recommendationReason: recommendation.reason,
      });
    }
  }, [recommendations, surface]);

  if (recommendations.length === 0) return null;

  const headingId = `${surface}-recommended-connections`;

  return (
    <section className="mt-7 border-t border-[#dfe2e5]/70 pt-6 text-left" aria-labelledby={headingId}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ee6243]">
        Continue exploring
      </p>
      <h2 id={headingId} className="mt-1.5 text-xl font-bold text-[#1d2944]">
        {surface === "daily" ? "Follow a thread from today’s puzzle" : "Related reviewed connections"}
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#657087]">
        {surface === "daily"
          ? "These editor-reviewed paths connect with an entity in the revealed challenge."
          : "Keep going with canonical paths backed by reviewed snapshots and source links."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <article
            key={recommendation.slug}
            className="rounded-xl border border-[#e4e6e9] bg-white/55 p-4"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#177258]">
              {recommendation.category}
            </p>
            <h3 className="mt-2 text-base font-bold leading-6 text-[#1d2944]">
              <AnalyticsLink
                href={recommendation.href}
                event="recommended_connection_opened"
                eventProperties={{
                  connection: recommendation.slug,
                  recommendationSurface: surface,
                  recommendationReason: recommendation.reason,
                }}
                onClick={() => {
                  if (recommendation.isEditorialRelated && sourceConnection) {
                    trackProductEvent("related_connection_opened", {
                      sourceConnection,
                      relatedConnection: recommendation.slug,
                    });
                  }
                }}
                className="rounded-sm underline decoration-[#e4b2a7] underline-offset-4 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
              >
                {recommendation.headline}
              </AnalyticsLink>
            </h3>
            <p className="mt-2 text-xs font-semibold text-[#7b8495]">
              {recommendation.sourceName} <span aria-hidden="true">→</span>{" "}
              {recommendation.targetName} · {recommendation.steps}{" "}
              {recommendation.steps === 1 ? "step" : "steps"}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#657087]">
              {recommendation.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
