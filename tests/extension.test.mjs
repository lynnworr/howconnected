import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HOWCONNECTED_ORIGIN,
  HOWCONNECTED_DAILY_URL,
  HOWCONNECTED_EXTENSION_URL,
  HOWCONNECTED_HOME_URL,
  HOWCONNECTED_SEARCH_ENDPOINT,
  WIKIPEDIA_API_ENDPOINT,
  buildConnectionUrl,
  buildExtensionReferralUrl,
  buildSearchUrl,
  buildWikipediaLookupUrl,
  canFindConnection,
  parseSearchResponse,
  parseWikipediaArticleUrl,
  parseWikipediaLookupResponse,
  selectedEntityAfterEdit,
} from "../extension/core.mjs";
import { handleSearchRequest } from "../lib/search-api.ts";
import { CHROME_WEB_STORE_URL } from "../lib/external-links.ts";
import {
  EXTENSION_RUNTIME_FILES,
  createDeterministicZip,
  readPngDimensions,
  validateExtensionManifest,
} from "../scripts/extension-release-lib.mjs";

const jobs = { id: "Q19837", label: "Steve Jobs", description: "American entrepreneur" };
const apple = { id: "Q312", label: "Apple Inc.", description: "Technology company" };

test("public installation uses the official Chrome Web Store listing", async () => {
  const publicPage = await readFile(
    new URL("../app/extension/page.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    CHROME_WEB_STORE_URL,
    "https://chromewebstore.google.com/detail/howconnected-for-wikipedi/ggmjkimekbccfllnjpcejkbagkaijnni",
  );
  assert.match(publicPage, /CHROME_WEB_STORE_URL/);
  assert.match(publicPage, /Add to Chrome/);
  assert.match(publicPage, /extension_install_clicked/);
  assert.doesNotMatch(publicPage, /Version 1\.1\.0|During pre-release testing/);
});

test("recognizes only encoded English Wikipedia article URLs", () => {
  assert.deepEqual(
    parseWikipediaArticleUrl("https://en.wikipedia.org/wiki/Tim_Berners-Lee#Early_life"),
    { status: "article", title: "Tim Berners-Lee" },
  );
  assert.deepEqual(
    parseWikipediaArticleUrl("https://en.wikipedia.org/wiki/Les_Mis%C3%A9rables"),
    { status: "article", title: "Les Misérables" },
  );
  for (const url of [
    "https://fr.wikipedia.org/wiki/Paris",
    "https://en.m.wikipedia.org/wiki/Paris",
    "https://en.wikipedia.org/w/index.php?title=Paris",
    "chrome://extensions",
    "not a url",
  ]) {
    assert.deepEqual(parseWikipediaArticleUrl(url), { status: "unsupported" });
  }
});

test("builds a fixed structured Wikipedia lookup with redirect resolution", () => {
  const url = new URL(buildWikipediaLookupUrl("Les Misérables"));
  assert.equal(url.origin + url.pathname, WIKIPEDIA_API_ENDPOINT);
  assert.equal(url.searchParams.get("action"), "query");
  assert.equal(url.searchParams.get("redirects"), "1");
  assert.equal(url.searchParams.get("prop"), "pageprops");
  assert.equal(url.searchParams.get("ppprop"), "wikibase_item|disambiguation");
  assert.equal(url.searchParams.get("titles"), "Les Misérables");
});

test("extracts a valid QID after Wikipedia redirect resolution", () => {
  const resolution = parseWikipediaLookupResponse({
    query: {
      redirects: [{ from: "NYC", to: "New York City" }],
      pages: [{
        pageid: 645042,
        ns: 0,
        title: "New York City",
        pageprops: { wikibase_item: "Q60" },
      }],
    },
  });
  assert.deepEqual(resolution, {
    status: "found",
    entity: {
      id: "Q60",
      label: "New York City",
      description: "Current English Wikipedia article",
    },
  });
});

test("rejects disambiguation, missing, non-article, and invalid-QID pages", () => {
  assert.deepEqual(
    parseWikipediaLookupResponse({
      query: { pages: [{ pageid: 1, ns: 0, title: "Mercury", pageprops: { disambiguation: "", wikibase_item: "Q123" } }] },
    }),
    { status: "disambiguation", title: "Mercury" },
  );
  assert.deepEqual(
    parseWikipediaLookupResponse({ query: { pages: [{ ns: 0, title: "Missing", missing: true }] } }),
    { status: "missing", title: "Missing" },
  );
  assert.deepEqual(
    parseWikipediaLookupResponse({ query: { pages: [{ pageid: 2, ns: 4, title: "Wikipedia:About", pageprops: { wikibase_item: "Q1" } }] } }),
    { status: "unsupported", title: "Wikipedia:About" },
  );
  assert.deepEqual(
    parseWikipediaLookupResponse({ query: { pages: [{ pageid: 3, ns: 0, title: "Broken", pageprops: { wikibase_item: "not-a-qid" } }] } }),
    { status: "missing-qid", title: "Broken" },
  );
  assert.deepEqual(parseWikipediaLookupResponse({ nope: true }), { status: "invalid" });
});

test("popup selection requires explicit, distinct Wikidata entities", () => {
  assert.equal(canFindConnection(jobs, apple), true);
  assert.equal(canFindConnection(jobs, jobs), false);
  assert.equal(canFindConnection(jobs, null), false);
  assert.equal(selectedEntityAfterEdit(jobs, "Steve Jobs"), jobs);
  assert.equal(selectedEntityAfterEdit(jobs, "Steve Job"), null);
});

test("search parsing accepts only bounded valid entities", () => {
  const payload = {
    results: [
      jobs,
      { id: "invalid", label: "Bad", description: "Bad" },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `Q${index + 100}`,
        label: `Entity ${index}`,
        description: "Description",
      })),
    ],
  };
  const results = parseSearchResponse(payload);
  assert.equal(results.length, 6);
  assert.equal(results[0].id, "Q19837");
  assert.deepEqual(parseSearchResponse({ error: "nope" }), []);
});

test("URL generation uses only fixed HTTPS origins and valid encoded QIDs", () => {
  assert.equal(
    buildConnectionUrl("Q19837", "Q312"),
    `${HOWCONNECTED_ORIGIN}/connect/Q19837/Q312?source=extension`,
  );
  assert.equal(HOWCONNECTED_DAILY_URL, `${HOWCONNECTED_ORIGIN}/daily?source=extension`);
  assert.equal(HOWCONNECTED_HOME_URL, `${HOWCONNECTED_ORIGIN}/?source=extension`);
  assert.equal(HOWCONNECTED_EXTENSION_URL, `${HOWCONNECTED_ORIGIN}/extension?source=extension`);
  assert.throws(() => buildExtensionReferralUrl("https://example.com/"), /stay on HowConnected/);
  assert.equal(
    new URL(buildSearchUrl("Tim Berners-Lee")).origin + new URL(buildSearchUrl("Tim Berners-Lee")).pathname,
    HOWCONNECTED_SEARCH_ENDPOINT,
  );
  assert.equal(new URL(buildSearchUrl("Tim Berners-Lee")).searchParams.get("q"), "Tim Berners-Lee");
  assert.throws(() => buildConnectionUrl("Q1", "not-valid"), /valid Wikidata QIDs/);
  assert.throws(() => buildConnectionUrl("Q1", "Q1"), /different entities/);
});

test("manifest uses minimal permissions and no background monitoring", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "1.1.0");
  assert.equal(manifest.name, "HowConnected for Wikipedia");
  assert.equal(manifest.permissions, undefined);
  assert.deepEqual(manifest.host_permissions, [
    "https://en.wikipedia.org/*",
    "https://www.howconnected.app/*",
  ]);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(validateExtensionManifest(manifest), []);
  const serialized = JSON.stringify(manifest);
  for (const forbidden of ["history", "storage", "cookies", "webRequest", "<all_urls>"]) {
    assert.ok(!serialized.includes(forbidden));
  }
});

test("manifest references valid PNG icons at every required size", async () => {
  for (const size of [16, 32, 48, 128]) {
    const icon = await readFile(new URL(`../extension/icons/icon-${size}.png`, import.meta.url));
    assert.deepEqual(readPngDimensions(icon), { width: size, height: size });
  }
});

test("release archive is deterministic and contains only runtime files", async () => {
  const files = await Promise.all(
    EXTENSION_RUNTIME_FILES.map(async (name) => ({
      name,
      data: await readFile(new URL(`../extension/${name}`, import.meta.url)),
    })),
  );
  const first = createDeterministicZip(files);
  const second = createDeterministicZip([...files].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.subarray(0, 4).toString("hex"), "504b0304");
  const serialized = first.toString("latin1");
  for (const runtimeFile of EXTENSION_RUNTIME_FILES) assert.ok(serialized.includes(runtimeFile));
  for (const excluded of ["PRIVACY.md", "README.md", ".env", ".map", "tests/", "server", "NEO4J_PASSWORD", "RESEND_API_KEY"]) {
    assert.ok(!serialized.includes(excluded));
  }
});

test("popup exposes accessible loading, fallback, and public privacy states", async () => {
  const [html, popup, styles] = await Promise.all([
    readFile(new URL("../extension/popup.html", import.meta.url), "utf8"),
    readFile(new URL("../extension/popup.js", import.meta.url), "utf8"),
    readFile(new URL("../extension/popup.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /data-loading="true"/);
  assert.match(html, /Play The Missing Link/);
  assert.match(html, /id="source-selection"[^>]+aria-live="polite"/);
  assert.match(html, /id="target-selection"[^>]+aria-live="polite"/);
  assert.match(html, /id="find-button"[^>]+aria-disabled="true"/);
  assert.match(html, /standard English Wikipedia article pages/i);
  assert.match(popup, /disambiguation page/);
  assert.match(popup, /not linked to a Wikidata entity/);
  assert.match(popup, /Wikipedia took too long to respond/);
  assert.match(popup, /search for both entities/);
  assert.match(popup, /Search took too long/);
  assert.match(popup, /Select a second entity from the suggestions/);
  assert.match(popup, /Searching…/);
  assert.match(popup, /HOWCONNECTED_EXTENSION_URL/);
  assert.match(popup, /HOWCONNECTED_DAILY_URL/);
  assert.match(popup, /Selected ·/);
  assert.match(styles, /button:focus-visible, input:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /width: 380px/);
  assert.match(styles, /max-height: 600px/);
  assert.doesNotMatch(html, /Prototype/);
});

test("extension requests are fixed, credential-free, and never send article content", async () => {
  const popup = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
  assert.match(popup, /credentials: "omit"/);
  assert.match(popup, /referrerPolicy: "no-referrer"/);
  assert.doesNotMatch(popup, /document\.body\.(innerText|textContent|innerHTML)/);
  assert.doesNotMatch(popup, /chrome\.(history|cookies|storage|webRequest)/);
  assert.doesNotMatch(popup, /localStorage|sessionStorage/);
  assert.equal((popup.match(/\bfetch\(/g) ?? []).length, 1);
  assert.match(popup, /fetchWithTimeout\(buildSearchUrl/);
  assert.match(popup, /fetchWithTimeout\(buildWikipediaLookupUrl/);
  assert.doesNotMatch(popup, /trackProductEvent|analytics/i);
});

test("search API stays closed to CORS and bounds extension-origin queries", async () => {
  let calls = 0;
  const search = async () => {
    calls += 1;
    return [jobs];
  };
  const request = new Request("https://www.howconnected.app/api/search?q=Jobs", {
    headers: { Origin: "chrome-extension://prototype-id" },
  });
  const response = await handleSearchRequest(request, search);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(calls, 1);

  const oversized = await handleSearchRequest(
    new Request(`https://www.howconnected.app/api/search?q=${"x".repeat(101)}`),
    search,
  );
  assert.deepEqual(await oversized.json(), { results: [] });
  assert.equal(calls, 1);
});

test("privacy disclosures match the implementation safeguards", async () => {
  const [markdown, html, publicPage] = await Promise.all([
    readFile(new URL("../extension/PRIVACY.md", import.meta.url), "utf8"),
    readFile(new URL("../extension/privacy.html", import.meta.url), "utf8"),
    readFile(new URL("../app/extension/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const disclosure of [markdown, html, publicPage]) {
    assert.match(disclosure, /does not|never/i);
    assert.match(disclosure, /browsing history/i);
    assert.match(disclosure, /advertising/i);
    assert.match(disclosure, /stores? no|stores? nothing|no user data/i);
    assert.match(disclosure, /Limited Use/i);
  }
  assert.equal(HOWCONNECTED_EXTENSION_URL, "https://www.howconnected.app/extension?source=extension");
});
