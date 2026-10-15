import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage search presentation is descriptive without duplicating accessible labels", async () => {
  const [home, explorer, entitySearch] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/EntitySearch.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /Discover surprising real-world connections/);
  assert.match(home, /type: "website"/);
  assert.match(home, /siteName: "HowConnected"/);
  assert.match(home, /"@type": "WebSite"/);
  assert.match(entitySearch, /<label className="sr-only"/);
  assert.match(entitySearch, /aria-describedby=/);
  assert.match(entitySearch, /: hint}/);
  assert.doesNotMatch(entitySearch, /: label}/);
  assert.match(explorer, /hint="Start with any person/);
  assert.match(explorer, /hint="Choose another entity/);
});

test("educational routes have contextual crawlable links", async () => {
  const [home, explore, methodology] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/explore/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/methodology/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const route of ["/explore", "/daily", "/methodology"]) {
    assert.match(home, new RegExp(`href="${route}"`));
  }
  assert.match(explore, /href="\/methodology"/);
  for (const route of ["/", "/explore", "/daily"]) {
    assert.match(methodology, new RegExp(`href="${route}"`));
  }
});

test("structured editorial data is emitted only for reviewed page data", async () => {
  const connectionPage = await readFile(
    new URL("../app/connect/[fromQid]/[toQid]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(connectionPage, /const editorialJsonLd = data\.editorial/);
  assert.match(connectionPage, /"@type": "WebPage"/);
  assert.match(connectionPage, /getCanonicalConnectionUrl\(fromQid, toQid\)/);
  assert.match(connectionPage, /JSON\.stringify\(editorialJsonLd\)\.replace/);
  assert.doesNotMatch(connectionPage, /editorialJsonLd.*discoverConnection/s);
});
