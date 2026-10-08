"use client";

import Image from "next/image";
import { useState } from "react";
import type { ConnectionNode, ConnectionPathData } from "@/components/connection-types";
import { getEntityInitials } from "@/lib/entity-image-utils";
import { trackProductEvent } from "@/lib/product-analytics";

type ConnectionPathProps = {
  path: ConnectionPathData;
  compact?: boolean;
  sourceContext?: "path" | "share_card";
};

function EntityCard({
  node,
  compact,
  featured,
  sourceContext,
}: {
  node: ConnectionNode;
  compact: boolean;
  featured: boolean;
  sourceContext: "path" | "share_card";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const visibleType = node.type && node.type !== "entity" ? node.type : "entity";
  const avatarSize = compact ? 38 : featured ? 56 : 48;
  const useContain = /(company|organization|business|brand)/i.test(visibleType);
  const primaryUrl = node.wikipediaUrl ?? node.wikidataUrl;
  const primaryDestination = node.wikipediaUrl ? "wikipedia" : "wikidata";

  function trackSource(destinationType: "wikipedia" | "wikidata") {
    if (!node.qid) return;
    trackProductEvent("entity_source_opened", {
      entityQid: node.qid,
      destinationType,
      sourceContext,
    });
  }

  const avatar = (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#e0e4e9] bg-[linear-gradient(145deg,#fff0e9,#e6f5ef)] font-extrabold text-[#33415f] ${
        featured ? "text-lg" : "text-sm"
      }`}
      style={{ width: avatarSize, height: avatarSize }}
    >
      {node.imageUrl && !imageFailed ? (
        <Image
          src={node.imageUrl}
          alt={node.imageAlt || `Image of ${node.name}`}
          width={avatarSize}
          height={avatarSize}
          sizes={`${avatarSize}px`}
          className={`h-full w-full ${useContain ? "object-contain p-1" : "object-cover"}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-label={`${node.name} placeholder`}>
          {getEntityInitials(node.name)}
        </span>
      )}
    </span>
  );

  return (
    <div
      className={`relative z-10 flex shrink-0 flex-col items-center justify-center rounded-xl border border-[#e3e5e8] bg-white/90 text-center shadow-[0_5px_18px_rgba(23,34,56,0.055)] ${
        compact
          ? "min-h-20 w-[min(100%,18rem)] px-3 py-2.5 md:h-24 md:w-28"
          : featured
            ? "min-h-32 w-[min(100%,18rem)] px-3.5 py-3.5 md:h-40 md:w-[8.5rem] md:py-2.5"
            : "min-h-28 w-[min(100%,18rem)] px-3 py-3 md:h-40 md:w-[7.75rem] md:py-2.5"
      }`}
    >
      {primaryUrl ? (
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSource(primaryDestination)}
          className="rounded-full transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          aria-label={`Open ${node.name} on ${node.sourceLabel ?? "its source page"} in a new tab`}
        >
          {avatar}
        </a>
      ) : (
        avatar
      )}
      <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#d45a40]">
        {visibleType}
      </span>
      {primaryUrl ? (
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSource(primaryDestination)}
          className="mt-1 max-w-full text-balance rounded-sm text-[13px] font-bold leading-[1.2] text-[#15213b] underline decoration-transparent underline-offset-2 transition hover:text-[#c9472d] hover:decoration-[#e9a18f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] md:text-sm"
        >
          {node.name} <span aria-hidden="true" className="text-[0.72em] text-[#8991a0]">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="mt-1 max-w-full text-balance text-[13px] font-bold leading-[1.2] text-[#15213b] md:text-sm">
          {node.name}
        </span>
      )}
      {node.wikidataUrl ? (
        <a
          href={node.wikidataUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSource("wikidata")}
          className="mt-1.5 rounded-sm text-[9px] font-medium text-[#8a91a0] underline decoration-transparent underline-offset-2 transition hover:text-[#b74a33] hover:decoration-[#d7dbe2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          aria-label={`Open the Wikidata source for ${node.name} in a new tab`}
        >
          Source <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </div>
  );
}

function RelationshipConnector({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-12 w-full shrink-0 items-center justify-center md:min-h-0 md:min-w-14 md:flex-1 md:max-w-24">
      <div className="absolute bottom-0 top-0 w-px bg-[#d5d9df] md:bottom-auto md:left-0 md:right-0 md:top-1/2 md:h-px md:w-auto" />
      <span className="relative z-10 max-w-40 rounded-full bg-[#fff4ef] px-2.5 py-1 text-center text-[10px] font-bold leading-tight text-[#9f4936] md:max-w-full">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-0 z-10 text-sm leading-none text-[#d66a50] md:bottom-auto md:right-0.5 md:rotate-[-90deg]"
      >
        ↓
      </span>
    </div>
  );
}

export default function ConnectionPath({
  path,
  compact = false,
  sourceContext = "path",
}: ConnectionPathProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center md:flex-row md:items-center">
      {path.nodes.map((node, index) => (
        <div
          className="contents"
          key={`${node.qid ?? node.name}-${index}`}
        >
          {index > 0 ? (
            <RelationshipConnector
              label={path.relationships[index - 1]?.label ?? "connected to"}
            />
          ) : null}
          <EntityCard
            node={node}
            compact={compact}
            featured={!compact && (index === 0 || index === path.nodes.length - 1)}
            sourceContext={sourceContext}
          />
        </div>
      ))}
    </div>
  );
}
