import { ImageResponse } from "next/og";
import { getEditorialSocialPreview } from "@/lib/editorial-social-preview";

const size = { width: 1200, height: 630 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fromQid: string; toQid: string }> },
) {
  const { fromQid, toQid } = await params;
  const preview = getEditorialSocialPreview(fromQid, toQid);
  if (!preview) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }

  const reviewed = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(preview.verifiedAt));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "58px 64px",
        color: "#f5f7fb",
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,104,70,.24), transparent 34%), radial-gradient(circle at 84% 72%, rgba(66,173,141,.2), transparent 36%), #101722",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            height: 46,
            borderRadius: 999,
            background: "#ff6846",
            color: "#101722",
            fontSize: 25,
            fontWeight: 900,
          }}
        >
          ↗
        </div>
        <div style={{ display: "flex", fontSize: 25, fontWeight: 800, letterSpacing: 3 }}>
          HOWCONNECTED
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            border: "1px solid rgba(255,255,255,.2)",
            borderRadius: 999,
            padding: "9px 16px",
            color: "#8edcc3",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          REVIEWED CONNECTION
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1040 }}>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 800, lineHeight: 1.08 }}>
          {preview.headline}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 34 }}>
          <div style={{ display: "flex", borderRadius: 999, padding: "14px 22px", background: "#ff6846", color: "#17100f", fontSize: 24, fontWeight: 800 }}>
            {preview.sourceName}
          </div>
          <div style={{ display: "flex", color: "#c8d0dc", fontSize: 20, fontWeight: 700 }}>
            {preview.relationship} →
          </div>
          <div style={{ display: "flex", borderRadius: 999, padding: "14px 22px", background: "#42ad8d", color: "#071712", fontSize: 24, fontWeight: 800 }}>
            {preview.targetName}
          </div>
        </div>
        {preview.qualifierSummary ? (
          <div style={{ display: "flex", marginTop: 22, color: "#aeb8c7", fontSize: 18 }}>
            {preview.qualifierSummary}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: "#909bad", fontSize: 17 }}>
        <div style={{ display: "flex" }}>Evidence-backed editorial snapshot</div>
        <div style={{ display: "flex" }}>Last reviewed {reviewed}</div>
      </div>
    </div>,
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
