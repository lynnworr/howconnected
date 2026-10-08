import { connection } from "next/server";
import { protectAdminData } from "@/lib/admin-auth";
import {
  parseAdminFeedbackFilter,
  parseAdminFeedbackReason,
} from "@/lib/admin-feedback-core";
import { getAdminFeedbackDashboard } from "@/lib/admin-feedback";

export async function GET(request: Request) {
  await connection();
  try {
    return await protectAdminData(request, async () => {
      const url = new URL(request.url);
      const filter = parseAdminFeedbackFilter(url.searchParams.get("filter") ?? undefined);
      const reason = parseAdminFeedbackReason(url.searchParams.get("reason") ?? undefined);
      return getAdminFeedbackDashboard(filter, reason);
    });
  } catch (error: unknown) {
    console.error("Admin feedback query failed", error);
    return Response.json(
      { error: "Could not load admin feedback." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, private",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
}
