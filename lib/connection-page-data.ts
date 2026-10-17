import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import type { SelectedEntity } from "@/components/connection-types";
import {
  resolveEditorialConnectionPageData,
  type ConnectionPageData,
} from "@/lib/connection-page-state";
import { parseDiscoveryResult } from "@/lib/connection-response";
import { discoverConnection } from "@/lib/discover-connection";
import { isValidQid } from "@/lib/wikidata-id";
import { findReservedFuturePuzzleByQids } from "@/lib/daily-puzzles";
import { fetchWikidataEntitySummaries } from "@/lib/wikidata";

export type { ConnectionPageData } from "@/lib/connection-page-state";

function toSelectedEntity(entity: {
  qid: string;
  name: string;
  description: string;
}): SelectedEntity {
  return {
    id: entity.qid,
    label: entity.name,
    description: entity.description,
  };
}

export const getConnectionPageData = cache(
  async (rawFromQid: string, rawToQid: string): Promise<ConnectionPageData> => {
    await connection();
    const fromQid = rawFromQid.trim().toUpperCase();
    const toQid = rawToQid.trim().toUpperCase();

    if (!isValidQid(fromQid) || !isValidQid(toQid)) {
      return { status: "invalid" };
    }

    const editorialData = resolveEditorialConnectionPageData(fromQid, toQid);
    if (editorialData) return editorialData;

    if (findReservedFuturePuzzleByQids(fromQid, toQid)) {
      return { status: "error" };
    }

    try {
      if (fromQid === toQid) {
        const [summary] = await fetchWikidataEntitySummaries([fromQid]);
        const entity = toSelectedEntity(
          summary ?? { qid: fromQid, name: "This entity", description: "" },
        );
        return { status: "same", source: entity, target: entity };
      }

      const discovered = await discoverConnection(fromQid, toQid);
      const result = parseDiscoveryResult(discovered);
      if (!result || !discovered.source || !discovered.target) {
        return { status: "error" };
      }

      return {
        status: result.found ? "success" : "empty",
        source: toSelectedEntity(discovered.source),
        target: toSelectedEntity(discovered.target),
        result,
      };
    } catch (error: unknown) {
      console.error("Shareable connection page failed", error);
      return { status: "error" };
    }
  },
);
