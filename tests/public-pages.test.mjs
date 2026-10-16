import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PUBLIC_ROUTES = ["about", "privacy", "terms", "contact", "methodology", "extension", "widgets/request"];

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
  assert.match(pages[3], /ContactForm/);
  assert.match(pages[3], /incorrect connection/);
  assert.match(pages[4], /Reviewed editorial connections/);
  assert.match(pages[4], /historical qualifiers/i);
  assert.match(pages[5], /requests no Chrome API permissions/);
  assert.match(pages[5], /Limited Use/);
  assert.match(pages[6], /PublisherRequestForm/);
  assert.match(pages[6], /editorial review/i);
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

  for (const route of PUBLIC_ROUTES.filter((route) => route !== "widgets/request")) {
    assert.match(footer, new RegExp(`/${route}`));
  }
  assert.match(footer, /\/widgets/);
  assert.doesNotMatch(footer, /\/admin/);
  assert.doesNotMatch(adminLayout, /PublicFooter/);
});

test("public brand marks link home with an accessible label while admin stays unchanged", async () => {
  const sharedHeader = await readFile(
    new URL("../components/PublicHeader.tsx", import.meta.url),
    "utf8",
  );
  const publicShellFiles = await Promise.all(
    [
      "../app/page.tsx",
      "../app/connect/[fromQid]/[toQid]/page.tsx",
      "../components/PublicPageShell.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const shareCard = await readFile(
    new URL("../components/ShareableConnectionCard.tsx", import.meta.url),
    "utf8",
  );
  const adminPage = await readFile(
    new URL("../app/admin/page.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(publicShellFiles.every((source) => source.includes("PublicHeader")));
  for (const source of [sharedHeader, shareCard]) {
    assert.match(source, /href="\/"/);
    assert.match(source, /aria-label="Go to HowConnected home"/);
    assert.match(source, /focus-visible:outline/);
  }
  assert.doesNotMatch(adminPage, /Go to HowConnected home/);
});

test("all public surfaces use the shared theme-aware frame", async () => {
  const [home, connect, shell, styles, network] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/connect/[fromQid]/[toQid]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PublicPageShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/NetworkBackdrop.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok([home, connect, shell].every((source) => source.includes("hc-public")));
  assert.ok([home, connect, shell].every((source) => source.includes("NetworkBackdrop")));
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.hc-search-submit:disabled/);
  assert.match(styles, /\.hc-node-aura\s*\{\s*opacity: 0\.045;/);
  assert.match(network, /<svg/);
  assert.match(network, /hc-network-lines/);
  assert.match(network, /hc-node-coral/);
  assert.match(network, /hc-node-teal/);
  assert.match(network, /pointer-events-none/);
  assert.doesNotMatch(styles, /background-size:\s*auto,\s*auto,\s*28px 28px/);
});

test("contact form uses shared theme surfaces without changing its submission contract", async () => {
  const [page, form] = await Promise.all([
    readFile(new URL("../app/contact/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ContactForm.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /hc-form-surface/);
  assert.match(form, /hc-form-control/);
  assert.match(form, /fetch\("\/api\/contact"/);
  assert.match(form, /name: formData\.get\("name"\)/);
  assert.match(form, /website: formData\.get\("website"\)/);
});

test("successful results include explanation sections and consent-gated ad reservations", async () => {
  const [insights, result, adPlacement] = await Promise.all([
    readFile(new URL("../components/ConnectionInsights.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ConnectionResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/FutureAdPlacement.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(insights, /So, how are they connected\?/);
  assert.match(insights, /Why this path works/);
  assert.match(insights, /The fun part/);
  assert.match(result, /editorial \? \(/);
  assert.match(adPlacement, /if \(!canRenderAdvertising\(activation\)\) return null/);
  assert.match(adPlacement, /min-h-\[250px\]/);
  assert.match(adPlacement, /Advertisement/);
  assert.doesNotMatch(adPlacement, /script/i);
});
