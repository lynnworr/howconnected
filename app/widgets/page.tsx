import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import AnalyticsLink from "@/components/AnalyticsLink";
import EmbedSnippet from "@/components/EmbedSnippet";
import PublisherLandingAnalytics from "@/components/PublisherLandingAnalytics";
import PublicPageShell from "@/components/PublicPageShell";
import { getEmbeddableConnections } from "@/lib/embed-connections";
import { SITE_ORIGIN } from "@/lib/seo";

const demoSlug = "nasa-dwight-eisenhower";
const demoUrl = `${SITE_ORIGIN}/embed/${demoSlug}`;
const demoSnippet = `<iframe src="${demoUrl}" title="HowConnected relationship: NASA and Dwight D. Eisenhower" loading="lazy" width="100%" height="560" style="border:0;max-width:760px" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

export const metadata: Metadata = {
  title: "Interactive relationship widgets for publishers | HowConnected",
  description: "Embed reviewed, evidence-linked connections in science, history, education, and culture stories—or request a custom publisher pilot widget.",
  alternates: { canonical: "/widgets" },
};

async function getWidgetExamples() {
  "use cache";
  cacheLife("days");
  return getEmbeddableConnections();
}

export default async function WidgetsPage() {
  const examples = await getWidgetExamples();
  return (
    <PublicPageShell
      eyebrow="Publisher pilot"
      title="Turn your articles into interactive discoveries."
      intro="Embed verified connections between people, discoveries, organizations, and ideas—without building your own research tools."
    >
      <PublisherLandingAnalytics />

      <section className="rounded-3xl border border-[#dfe2e5] bg-white/55 p-5 sm:p-7" aria-labelledby="publisher-fit">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <h2 id="publisher-fit">Give readers a useful next question</h2>
            <p className="mt-3 max-w-2xl">
              HowConnected widgets turn a factual relationship into a compact, explorable teaching moment. They are designed for science writers, history blogs, educational publishers, schools, and independent creators who want clear context without sending readers into an unsupported search result.
            </p>
          </div>
          <AnalyticsLink
            href="/widgets/request"
            event="publisher_request_cta_clicked"
            eventProperties={{ publisherPlacement: "hero" }}
            className="hc-primary-button inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-sm font-bold no-underline! focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
          >
            Request a custom widget
          </AnalyticsLink>
        </div>
      </section>

      <section aria-labelledby="widget-demo">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="widget-demo">Live interactive demo</h2>
            <p className="mt-2">Open the evidence disclosure or follow a source link to see the reader experience.</p>
          </div>
          <AnalyticsLink
            href={`/embed/${demoSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            event="publisher_demo_interacted"
            eventProperties={{ action: "open_demo" }}
          >
            Open demo in a new tab
          </AnalyticsLink>
        </div>
        <div className="mt-4 overflow-hidden rounded-[24px] border border-[#dfe2e5] bg-[#f7f5ef]">
          <iframe
            src={`/embed/${demoSlug}`}
            title="HowConnected relationship: NASA and Dwight D. Eisenhower"
            loading="lazy"
            width="100%"
            height="560"
            className="block w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>

      <section aria-labelledby="widget-value">
        <h2 id="widget-value">Built for explanation, not decoration</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["A concise relationship", "Readers see the people or organizations, the direction of the connection, and a plain-language explanation."],
            ["Sources within reach", "Wikipedia, Wikidata, relationship properties, and reviewed supporting evidence remain one click away."],
            ["Editorial boundaries", "Only approved snapshot-backed connections can render. Unknown or unreviewed slugs return not found."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-[#dfe2e5] bg-white/55 p-4">
              <h3 className="font-bold text-[#1d2944]">{title}</h3>
              <p className="mt-2 text-sm leading-6">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="widget-install">
        <h2 id="widget-install">Install in three steps</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Choose", "Use one of the approved examples below, or request editorial review for a new relationship."],
            ["2", "Copy", "Copy the iframe snippet and keep its responsive width, height, sandbox, and referrer policy intact."],
            ["3", "Publish and test", "Paste it into an HTTPS article page, then check the widget and new-tab source links on desktop and mobile."],
          ].map(([number, title, description]) => (
            <li key={number} className="list-none rounded-2xl border border-[#dfe2e5] bg-white/55 p-4">
              <span className="grid size-8 place-items-center rounded-full bg-[#17233f] text-sm font-extrabold text-white">{number}</span>
              <h3 className="mt-3 font-bold text-[#1d2944]">{title}</h3>
              <p className="mt-2 text-sm leading-6">{description}</p>
            </li>
          ))}
        </ol>
        <div className="hc-form-surface mt-5 rounded-2xl border p-4 sm:p-5">
          <EmbedSnippet snippet={demoSnippet} />
        </div>
      </section>

      <section aria-labelledby="widget-examples">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="widget-examples">Available approved examples</h2>
            <p className="mt-2">Each stable slug points to reviewed editorial content—not a live or arbitrary graph search.</p>
          </div>
          <AnalyticsLink
            href="/widgets/request"
            event="publisher_request_cta_clicked"
            eventProperties={{ publisherPlacement: "examples" }}
          >
            Need a different connection?
          </AnalyticsLink>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {examples.map(({ connection, snapshot }) => (
            <li key={connection.slug} className="rounded-xl border border-[#dfe2e5] bg-white/55 p-4">
              <p className="font-bold text-[#1d2944]">{snapshot.source.label} → {snapshot.target.label}</p>
              <code className="mt-1 block break-all text-xs text-[#657087]">/embed/{connection.slug}</code>
              <Link href={`/embed/${connection.slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex">Preview widget</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="widget-standards">
        <h2 id="widget-standards">Evidence and attribution standards</h2>
        <p>
          Every published widget is backed by a committed editorial snapshot, validated relationship direction, Wikidata property links, Wikipedia articles where available, and reviewed supporting sources. Historical qualifiers and ambiguity are checked before approval. HowConnected branding and the “Explore on HowConnected” link remain visible so readers can understand the source and continue exploring.
        </p>
      </section>

      <section className="rounded-3xl border border-[#dfe2e5] bg-white/55 p-5 sm:p-7" aria-labelledby="widget-limits">
        <h2 id="widget-limits">A transparent pilot</h2>
        <p className="mt-3">
          The pilot does not guarantee acceptance or turnaround times, accept arbitrary graph paths, expose unpublished content, support white-label styling, provide publisher dashboards, or include a paid plan. Custom requests require manual editorial review. Commercial-interest answers are nonbinding research—not orders or payment commitments.
        </p>
        <p className="mt-3">
          Aggregate analytics can count landing-page visits, successful snippet copies, fixed CTA actions, approved-widget link opens, and successful requests. They do not include publisher names, email addresses, website URLs, requested topics, or free-form context.
        </p>
        <p className="mt-3">
          The pilot adds no third-party cookies, fingerprinting, personal identifiers, or cross-site activity profiles.
        </p>
        <div className="mt-5 flex flex-wrap gap-4">
          <AnalyticsLink
            href="/widgets/request"
            event="publisher_request_cta_clicked"
            eventProperties={{ publisherPlacement: "limitations" }}
            className="hc-primary-button inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-sm font-bold no-underline! focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
          >
            Request editorial review
          </AnalyticsLink>
          <Link href="/contact" className="inline-flex min-h-12 items-center">Ask a general question</Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
