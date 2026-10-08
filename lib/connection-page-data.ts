import "server-only";

import { cache } from "react";
import type { SelectedEntity } from "@/components/connection-types";
import { parseDiscoveryResult } from "@/lib/connection-response";
import { discoverConnection } from "@/lib/discover-connection";
import { isValidQid } from "@/lib/wikidata-id";
import { fetchWikidataEntitySummaries } from "@/lib/wikidata";

export type ConnectionPageData =
  | { status: "invalid" }
  | { status: "error" }
  | {
      status: "same";
      source: SelectedEntity;
      target: SelectedEntity;
    }
  | {
      status: "success" | "empty";
      source: SelectedEntity;
      target: SelectedEntity;
      result: NonNullable<ReturnType<typeof parseDiscoveryResult>>;
    };

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
    const fromQid = rawFromQid.trim().toUpperCase();
    const toQid = rawToQid.trim().toUpperCase();

    if (!isValidQid(fromQid) || !isValidQid(toQid)) {
      return { status: "invalid" };
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
