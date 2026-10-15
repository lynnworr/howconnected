import { ImageResponse } from "next/og";

export const alt = "The Missing Link — a verified daily connection challenge from HowConnected";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #fffdf9 0%, #f6efe8 58%, #e5f2ee 100%)",
        color: "#15213b",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        textAlign: "center",
        width: "100%",
      }}
    >
      <div style={{ color: "#a4432d", display: "flex", fontSize: 25, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>
        HowConnected daily challenge
      </div>
      <div style={{ display: "flex", fontSize: 82, fontWeight: 800, letterSpacing: "-0.05em", marginTop: 28 }}>
        The Missing Link
      </div>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700, marginTop: 38 }}>
        Two endpoints. One hidden connection.
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: 24, marginTop: 54 }}>
        <span style={{ background: "#17233f", borderRadius: 999, color: "white", display: "flex", fontSize: 27, fontWeight: 800, padding: "18px 30px" }}>START</span>
        <span style={{ color: "#a4432d", display: "flex", fontSize: 36 }}>— ? —</span>
        <span style={{ background: "#17233f", borderRadius: 999, color: "white", display: "flex", fontSize: 27, fontWeight: 800, padding: "18px 30px" }}>FINISH</span>
      </div>
    </div>,
    size,
  );
}
