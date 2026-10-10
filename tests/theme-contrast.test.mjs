import assert from "node:assert/strict";
import test from "node:test";

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("core light and dark theme text tokens meet WCAG AA contrast", () => {
  const pairs = [
    ["#15213b", "#f7f5ef"],
    ["#657087", "#f7f5ef"],
    ["#ffffff", "#17233f"],
    ["#f3f4f6", "#080a0e"],
    ["#b5bdc9", "#080a0e"],
    ["#ffffff", "#1c232d"],
    ["#170b08", "#f26144"],
    ["#b9c0ca", "#1e232a"],
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});
