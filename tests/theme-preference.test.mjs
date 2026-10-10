import assert from "node:assert/strict";
import test from "node:test";
import {
  nextPublicTheme,
  parsePublicTheme,
  persistPublicTheme,
  readPublicTheme,
  resolvePublicTheme,
  THEME_STORAGE_KEY,
} from "../lib/theme-preference.ts";

test("theme preferences accept only explicit light or dark values", () => {
  assert.equal(THEME_STORAGE_KEY, "howconnected:theme");
  assert.equal(parsePublicTheme(undefined), null);
  assert.equal(parsePublicTheme("system"), null);
  assert.equal(parsePublicTheme("light"), "light");
  assert.equal(parsePublicTheme("dark"), "dark");
});

test("first visit follows the system while an explicit preference wins", () => {
  assert.equal(resolvePublicTheme(null, true), "dark");
  assert.equal(resolvePublicTheme(null, false), "light");
  assert.equal(resolvePublicTheme("light", true), "light");
  assert.equal(resolvePublicTheme("dark", false), "dark");
});

test("theme toggle switches predictably in both directions", () => {
  assert.equal(nextPublicTheme("light"), "dark");
  assert.equal(nextPublicTheme("dark"), "light");
});

test("explicit preferences persist under the stable local storage key", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(readPublicTheme(storage), null);
  persistPublicTheme(storage, "dark");
  assert.equal(readPublicTheme(storage), "dark");
  persistPublicTheme(storage, "light");
  assert.equal(readPublicTheme(storage), "light");
});

test("layout resolves the theme before body content hydrates", async () => {
  const { readFile } = await import("node:fs/promises");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /localStorage\.getItem\('howconnected:theme'\)/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.ok(layout.indexOf("dangerouslySetInnerHTML") < layout.indexOf("<body"));
  assert.match(layout, /suppressHydrationWarning/);
});
