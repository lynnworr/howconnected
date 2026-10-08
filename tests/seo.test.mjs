import assert from "node:assert/strict";
import test from "node:test";
import {
  getCanonicalConnectionUrl,
  getIndexableUrls,
  INDEXABLE_CONNECTIONS,
  ROBOTS_RULES,
  SITE_ORIGIN,
} from "../lib/seo.ts";

test("uses the production domain for canonical connection URLs", () => {
  assert.equal(
    getCanonicalConnectionUrl("Q19837", "Q8704"),
    "https://www.howconnected.app/connect/Q19837/Q8704",
  );
});

test("publishes only the homepage and bounded curated connections", () => {
  const urls = getIndexableUrls();

  assert.equal(urls.length, INDEXABLE_CONNECTIONS.length + 1);
  assert.equal(urls[0], SITE_ORIGIN);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.startsWith(SITE_ORIGIN)));
  assert.ok(
    urls.slice(1).every((url) =>
      /^https:\/\/www\.howconnected\.app\/connect\/Q[1-9]\d*\/Q[1-9]\d*$/.test(
        url,
      ),
    ),
  );
  assert.ok(urls.every((url) => !url.includes("/admin")));
  assert.ok(urls.every((url) => !url.includes("/api/")));
});

test("allows public discovery while excluding private and API routes", () => {
  assert.deepEqual(ROBOTS_RULES, {
    userAgent: "*",
    allow: ["/", "/connect/"],
    disallow: ["/admin", "/api/"],
  });
});
