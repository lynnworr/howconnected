"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
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
  sourceContext,
}: {
  node: ConnectionNode;
  compact: boolean;
  sourceContext: "path" | "share_card";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const visibleType = node.type && node.type !== "entity" ? node.type : "entity";
  const avatarSize = compact ? 38 : 52;
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
        compact ? "text-sm" : "text-base"
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
      className={`relative z-10 flex shrink-0 flex-col items-center rounded-xl border border-[#e6e7e8] bg-[#fffdf9]/95 text-center shadow-[0_3px_12px_rgba(23,34,56,0.045)] ${
        compact
          ? "min-h-24 w-[min(100%,18rem)] px-3 py-2.5 md:h-28 md:w-24"
          : "h-40 w-[min(100%,18rem)] px-3 py-2.5 md:w-32"
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
          className="mt-1 flex min-h-9 max-w-full items-center justify-center text-balance rounded-sm text-[13px] font-bold leading-[1.2] text-[#15213b] underline decoration-transparent underline-offset-2 transition hover:text-[#c9472d] hover:decoration-[#e9a18f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] md:text-sm"
        >
          {node.name} <span aria-hidden="true" className="text-[0.72em] text-[#8991a0]">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="mt-1 flex min-h-9 max-w-full items-center justify-center text-balance text-[13px] font-bold leading-[1.2] text-[#15213b] md:text-sm">
          {node.name}
        </span>
      )}
      {node.wikidataUrl ? (
        <a
          href={node.wikidataUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSource("wikidata")}
          className="mt-auto rounded-sm pt-1 text-[9px] font-medium text-[#8a91a0] underline decoration-transparent underline-offset-2 transition hover:text-[#b74a33] hover:decoration-[#d7dbe2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
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
    <div className="relative z-20 flex min-h-12 w-full shrink-0 items-center justify-center md:min-h-0 md:w-full">
      <span className="flex max-w-40 flex-col items-center gap-0.5 bg-[#fbfaf7] px-2 py-1 text-center text-[10px] font-semibold leading-tight text-[#9f4936] md:max-w-full md:flex-row md:gap-1">
        <span>{label}</span>
        <span aria-hidden="true" className="text-xs leading-none text-[#c9634d] md:hidden">
          ↓
        </span>
        <span aria-hidden="true" className="hidden text-xs leading-none text-[#c9634d] md:inline">
          →
        </span>
      </span>
    </div>
  );
}

export default function ConnectionPath({
  path,
  compact = false,
  sourceContext = "path",
}: ConnectionPathProps) {
  const nodeWidth = compact ? 96 : 128;
  const minimumConnectorWidth = compact ? 48 : 56;
  const maximumConnectorWidth = compact ? 64 : 96;
  const maximumPathWidth = compact ? 816 : 1088;
  const connectorCount = Math.max(1, path.nodes.length - 1);
  const connectorWidth = Math.max(
    minimumConnectorWidth,
    Math.min(
      maximumConnectorWidth,
      Math.floor(
        (maximumPathWidth - nodeWidth * path.nodes.length) / connectorCount,
      ),
    ),
  );
  const desktopColumns = path.nodes
    .flatMap((_, index) =>
      index === path.nodes.length - 1
        ? [`${nodeWidth}px`]
        : [`${nodeWidth}px`, `${connectorWidth}px`],
    )
    .join(" ");
  const linePosition = compact
    ? "top-12 bottom-12 md:bottom-auto md:left-12 md:right-12 md:top-1/2"
    : "top-20 bottom-20 md:bottom-auto md:left-16 md:right-16 md:top-1/2";

  return (
    <div
      className="relative mx-auto flex w-full flex-col items-center justify-center md:grid md:w-fit md:items-center"
      style={{ gridTemplateColumns: desktopColumns } as CSSProperties}
    >
      <div
        aria-hidden="true"
        className={`absolute left-1/2 w-px -translate-x-1/2 bg-[#d7dbe0] md:h-px md:w-auto md:translate-x-0 ${linePosition}`}
      />
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
            sourceContext={sourceContext}
          />
        </div>
      ))}
    </div>
  );
}
