"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/product-analytics";
import type { TrendingConnection } from "@/lib/trending-connections";

export default function TrendingConnections({
  connections,
}: {
  connections: readonly TrendingConnection[];
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || connections.length < 2) return;
    tracked.current = true;
    for (const connection of connections) {
      trackProductEvent("trending_connection_impression", {
        connection: connection.slug,
        trendObservedAt: connection.trendObservedAt,
        trendExpiresAt: connection.trendExpiresAt,
      });
    }
  }, [connections]);

  if (connections.length < 2) return null;

  return (
    <section className="mt-10 w-full max-w-5xl text-left" aria-labelledby="trending-connections">
      <div className="text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">
          Timely, editor reviewed
        </p>
        <h2 id="trending-connections" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#1d2944] sm:text-3xl">
          Trending connections
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#657087]">
          Current stories, traced through verified relationship paths.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => (
          <article key={connection.slug} className="hc-discovery-card group flex h-full flex-col rounded-[20px] border p-4 sm:p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#177258]">
              {connection.trendLabel}
            </p>
            <h3 className="mt-2 text-base font-bold leading-6 text-[#1d2944]">{connection.headline}</h3>
            <p className="mt-3 flex-1 text-xs leading-5 text-[#657087]">
              {connection.sourceName} <span aria-hidden="true" className="text-[#ee6243]">→</span> {connection.targetName} · {connection.steps} steps
            </p>
            <Link
              href={connection.href}
              onClick={() => trackProductEvent("trending_connection_opened", {
                connection: connection.slug,
                trendObservedAt: connection.trendObservedAt,
                trendExpiresAt: connection.trendExpiresAt,
              })}
              className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 group-hover:text-[#ee6243] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
            >
              Open connection <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
