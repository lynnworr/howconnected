import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function relativeLuminance(hex) {
  const channels = hex.match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("daily challenge small text and answer labels meet WCAG AA contrast in both themes", async () => {
  const component = await readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /text-\[#ee6243\]/);
  assert.doesNotMatch(component, /text-\[#818999\]/);
  assert.ok(contrast("a4432d", "fffdf9") >= 4.5);
  assert.ok(contrast("657087", "fffdf9") >= 4.5);
  assert.ok(contrast("15213b", "fffdf9") >= 4.5);
  assert.ok(contrast("ff9b84", "12171e") >= 4.5);
  assert.ok(contrast("b5bdc9", "12171e") >= 4.5);
  assert.ok(contrast("f3f4f6", "12171e") >= 4.5);
});

test("daily controls retain native keyboard semantics, touch targets, live feedback, and reduced motion", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../components/DailyChallenge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /<form[^>]+onSubmit=/);
  assert.match(component, /<fieldset disabled=\{revealed\}>/);
  assert.match(component, /<legend className="sr-only">Choose one answer<\/legend>/);
  assert.match(component, /type="radio"/);
  assert.match(component, /min-h-14/);
  assert.match(component, /type="submit"[^>]+min-h-11/);
  assert.match(component, /role="status"/);
  assert.ok((component.match(/aria-live="polite"/g) ?? []).length >= 2);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation: none !important/);
  assert.match(styles, /transition-duration: 0\.01ms !important/);
});
