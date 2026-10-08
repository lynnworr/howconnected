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

function EntityNode({
  node,
  compact,
  position,
  sourceContext,
}: {
  node: ConnectionNode;
  compact: boolean;
  position: "first" | "middle" | "last" | "only";
  sourceContext: "path" | "share_card";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const visibleType = node.type && node.type !== "entity" ? node.type : "entity";
  const avatarSize = compact ? 44 : 64;
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

  const railPosition =
    position === "first"
      ? "left-1/2 right-0"
      : position === "last"
        ? "left-0 right-1/2"
        : "inset-x-0";

  return (
    <div
      className={`relative z-10 flex w-[min(100%,18rem)] shrink-0 flex-col items-center text-center lg:grid lg:w-full ${
        compact
          ? "lg:h-44 lg:grid-rows-[2.5rem_3rem_0.75rem_3rem_1.5rem]"
          : "lg:h-52 lg:grid-rows-[3rem_4rem_0.75rem_3rem_1.5rem]"
      }`}
    >
      <span aria-hidden="true" className="hidden lg:block" />
      <div
        className={`relative flex w-full items-center justify-center ${compact ? "h-12" : "h-16"} lg:h-full`}
      >
        {position !== "only" ? (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 hidden h-px -translate-y-1/2 bg-[#d7dbe0] lg:block ${railPosition}`}
          />
        ) : null}
        {primaryUrl ? (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackSource(primaryDestination)}
            className="relative z-10 rounded-full shadow-[0_4px_14px_rgba(23,34,56,0.1)] transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
            aria-label={`Open ${node.name} on ${node.sourceLabel ?? "its source page"} in a new tab`}
          >
            {avatar}
          </a>
        ) : (
          <span className="relative z-10">{avatar}</span>
        )}
      </div>
      <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#d45a40] lg:mt-0">
        {visibleType}
      </span>
      <span className="mt-1 flex min-h-10 max-w-full items-center justify-center text-balance text-[13px] font-bold leading-[1.2] text-[#15213b] lg:mt-0 lg:px-1 lg:text-sm">
        {node.name}
      </span>
      {node.wikidataUrl ? (
        <a
          href={node.wikidataUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSource("wikidata")}
          title={`Open ${node.name} source`}
          className="mt-1 inline-grid size-6 place-items-center rounded-full text-[#8a91a0] transition hover:bg-[#fff0eb] hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] lg:mt-0 lg:justify-self-center"
          aria-label={`Open ${node.name} source`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
          >
            <path
              d="M6 3H3.75A.75.75 0 0 0 3 3.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75V10M9 3h4v4M13 3 7.5 8.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

function RelationshipConnector({
  label,
  compact,
}: {
  label: string;
  compact: boolean;
}) {
  return (
    <div className="relative z-20 w-full shrink-0">
      <div className="grid h-20 grid-rows-[1fr_auto_1fr] lg:hidden">
        <span aria-hidden="true" className="h-full w-px justify-self-center bg-[#d7dbe0]" />
        <span className="bg-[#fbfaf7] px-2 py-1 text-center text-[10px] font-semibold leading-tight text-[#9f4936]">
          {label}
        </span>
        <span aria-hidden="true" className="flex flex-col items-center text-xs leading-none text-[#c9634d]">
          <span className="min-h-0 w-px flex-1 bg-[#d7dbe0]" />
          ↓
        </span>
      </div>
      <div
        className={`hidden w-full lg:grid ${
          compact
            ? "h-44 grid-rows-[2.5rem_3rem_1fr]"
            : "h-52 grid-rows-[3rem_4rem_1fr]"
        }`}
      >
        <span className="flex items-end justify-center px-1 pb-1 text-center text-[9px] font-semibold leading-[1.15] text-[#9f4936]">
          {label}
        </span>
        <span aria-hidden="true" className="flex items-center text-sm leading-none text-[#c9634d]">
          <span className="h-px min-w-0 flex-1 bg-[#d7dbe0]" />
          →
        </span>
      </div>
    </div>
  );
}

export default function ConnectionPath({
  path,
  compact = false,
  sourceContext = "path",
}: ConnectionPathProps) {
  const nodeCount = path.nodes.length;
  const nodeWidth = compact
    ? 96
    : nodeCount <= 4
      ? 138
      : nodeCount === 5
        ? 120
        : 100;
  const connectorWidth = compact
    ? 48
    : nodeCount <= 4
      ? 110
      : nodeCount === 5
        ? 70
        : 56;
  const desktopColumns = path.nodes
    .flatMap((_, index) =>
      index === path.nodes.length - 1
        ? [`${nodeWidth}px`]
        : [`${nodeWidth}px`, `${connectorWidth}px`],
    )
    .join(" ");

  return (
    <div
      className="relative mx-auto flex w-full flex-col items-center justify-center lg:grid lg:w-fit lg:items-start"
      style={{ gridTemplateColumns: desktopColumns } as CSSProperties}
    >
      {path.nodes.map((node, index) => (
        <div
          className="contents"
          key={`${node.qid ?? node.name}-${index}`}
        >
          {index > 0 ? (
            <RelationshipConnector
              label={path.relationships[index - 1]?.label ?? "connected to"}
              compact={compact}
            />
          ) : null}
          <EntityNode
            node={node}
            compact={compact}
            position={
              nodeCount === 1
                ? "only"
                : index === 0
                  ? "first"
                  : index === nodeCount - 1
                    ? "last"
                    : "middle"
            }
            sourceContext={sourceContext}
          />
        </div>
      ))}
    </div>
  );
}
