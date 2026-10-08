import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PUBLIC_ROUTES = ["about", "privacy", "terms", "contact"];

test("all public policy and information routes have page content", async () => {
  const pages = await Promise.all(
    PUBLIC_ROUTES.map((route) =>
      readFile(new URL(`../app/${route}/page.tsx`, import.meta.url), "utf8"),
    ),
  );

  assert.ok(pages.every((page) => page.includes("PublicPageShell")));
  assert.match(pages[0], /Wikidata/);
  assert.match(pages[1], /Google.*Ads Settings/s);
  assert.match(pages[2], /informational and entertainment service/);
  assert.match(pages[3], /CONTACT_EMAIL/);
});

test("public footer links to public routes and never exposes admin", async () => {
  const footer = await readFile(
    new URL("../components/PublicFooter.tsx", import.meta.url),
    "utf8",
  );
  const adminLayout = await readFile(
    new URL("../app/admin/layout.tsx", import.meta.url),
    "utf8",
  );

  for (const route of PUBLIC_ROUTES) assert.match(footer, new RegExp(`/${route}`));
  assert.doesNotMatch(footer, /\/admin/);
  assert.doesNotMatch(adminLayout, /PublicFooter/);
});

test("successful results include explanation sections and a non-rendering ad reservation", async () => {
  const insights = await readFile(
    new URL("../components/ConnectionInsights.tsx", import.meta.url),
    "utf8",
  );
  const adPlacement = await readFile(
    new URL("../components/FutureAdPlacement.tsx", import.meta.url),
    "utf8",
  );

  assert.match(insights, /So, how are they connected\?/);
  assert.match(insights, /Why this path works/);
  assert.match(insights, /The fun part/);
  assert.match(adPlacement, /return null/);
  assert.doesNotMatch(adPlacement, /script/i);
});
