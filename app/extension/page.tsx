import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "HowConnected Chrome Extension",
  description:
    "Use HowConnected from English Wikipedia with a privacy-conscious Chrome extension that requests only narrowly scoped permissions.",
  alternates: { canonical: "/extension" },
  openGraph: {
    title: "HowConnected for Wikipedia",
    description:
      "Start with the English Wikipedia article you are reading and discover a verified Wikidata connection.",
    url: "/extension",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HowConnected for Wikipedia",
    description:
      "Start with an English Wikipedia article and explore how its subject connects to another entity.",
  },
};

export default function ExtensionPage() {
  return (
    <PublicPageShell
      eyebrow="Chrome extension · Version 1.1.0"
      title="HowConnected for Wikipedia"
      intro="A free, focused Chrome extension that turns the English Wikipedia article you are reading into the starting point for a HowConnected search."
    >
      <section>
        <h2>What the extension does</h2>
        <p>
          Click the HowConnected toolbar icon while viewing a standard English
          Wikipedia article. The popup resolves that article&apos;s structured
          Wikidata identifier, lets you confirm or change the starting entity,
          and asks you to choose a destination. Your connection then opens on
          HowConnected in a new tab.
        </p>
        <p>
          If the page is unsupported, ambiguous, missing a Wikidata identifier,
          or temporarily unavailable, the popup provides the same two-entity
          search as a fallback.
        </p>
        <p>
          The popup also opens The Missing Link, HowConnected&apos;s verified
          daily connection challenge, even when the active tab is not Wikipedia.
        </p>
      </section>

      <section>
        <h2>Permissions</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong>en.wikipedia.org:</strong> lets the popup recognize the
            active page only when it is on English Wikipedia, then calls
            Wikipedia&apos;s structured Action API to resolve redirects,
            disambiguation state, and the article&apos;s Wikidata QID.
          </li>
          <li>
            <strong>www.howconnected.app:</strong> requests bounded entity-search
            suggestions and opens the connection page you explicitly request.
          </li>
        </ul>
        <p>
          The extension requests no Chrome API permissions. It does not request
          history, activeTab, storage, cookies, scripting,
          webRequest, broad all-sites access, a background worker, or content-script
          access.
        </p>
      </section>

      <section>
        <h2>Data sent and data not collected</h2>
        <p>
          The decoded Wikipedia article title is sent directly to English
          Wikipedia to retrieve its Wikidata QID. Search text you enter is sent
          to HowConnected for autocomplete. When you continue, the two selected
          Wikidata QIDs appear in the HowConnected connection URL.
          User-opened HowConnected pages also receive the fixed
          <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
            source=extension
          </code>
          label for referral measurement. It contains no personal identifier or
          Wikipedia title.
        </p>
        <p>
          HowConnected does not receive the full active-tab URL or the article
          body. The extension stores no user data and does not keep browsing history,
          save search history, run analytics, access cookies, or collect
          information for advertising. It makes no requests while its popup is
          closed.
        </p>
      </section>

      <section>
        <h2>Privacy and limited use</h2>
        <p>
          Information accessed by the extension is used only to provide its
          single, user-initiated connection-finding feature. It is not sold,
          used for personalized advertising, or transferred to data brokers.
          HowConnected&apos;s use of information received from Chrome APIs complies
          with the Chrome Web Store User Data Policy, including its Limited Use
          requirements.
        </p>
        <p>
          Website requests are also covered by the main{" "}
          <Link href="/privacy">HowConnected privacy policy</Link>.
        </p>
      </section>

      <section>
        <h2>Installation and support</h2>
        <p>
          During pre-release testing, install the unpacked build from
          <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
            chrome://extensions
          </code>
          with Developer mode enabled. Store installations and upgrades will be
          managed by Chrome after the public listing is approved.
        </p>
        <p>
          To report a privacy concern, incorrect detection, or connection issue,
          use the <Link href="/contact">HowConnected contact form</Link>.
        </p>
      </section>
    </PublicPageShell>
  );
}
