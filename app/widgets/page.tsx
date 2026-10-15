import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import EmbedSnippet from "@/components/EmbedSnippet";
import PublicPageShell from "@/components/PublicPageShell";
import { getEmbeddableConnections } from "@/lib/embed-connections";
import { SITE_ORIGIN } from "@/lib/seo";

const demoSlug = "nasa-dwight-eisenhower";
const demoUrl = `${SITE_ORIGIN}/embed/${demoSlug}`;
const demoSnippet = `<iframe src="${demoUrl}" title="HowConnected relationship: NASA and Dwight D. Eisenhower" loading="lazy" width="100%" height="560" style="border:0;max-width:760px" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

export const metadata: Metadata = {
  title: "Embed a verified connection | HowConnected",
  description: "Add a compact, evidence-linked HowConnected relationship explainer to an article, lesson, or publication.",
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
    <PublicPageShell eyebrow="Publisher pilot" title="Put a verified connection in your story." intro="A free, lightweight iframe for educators, bloggers, and publishers. Each widget uses a reviewed HowConnected snapshot and links readers to the underlying evidence.">
      <section aria-labelledby="widget-demo">
        <h2 id="widget-demo">Interactive demo</h2>
        <div className="mt-4 overflow-hidden rounded-[24px] border border-[#dfe2e5] bg-[#f7f5ef]">
          <iframe src={`/embed/${demoSlug}`} title="HowConnected relationship: NASA and Dwight D. Eisenhower" loading="lazy" width="100%" height="560" className="block w-full border-0" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      </section>

      <section aria-labelledby="widget-install">
        <h2 id="widget-install">Copy and publish</h2>
        <p>Paste this iframe where your publishing platform accepts HTML. Keep the responsive width and a minimum height of 560 pixels so evidence links remain comfortable on narrow screens.</p>
        <div className="mt-4"><EmbedSnippet snippet={demoSnippet} /></div>
      </section>

      <section aria-labelledby="widget-examples">
        <h2 id="widget-examples">Available approved examples</h2>
        <p>Only the reviewed examples below are available in the pilot. The slug is the stable public widget identifier.</p>
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
        <p>Every published widget is backed by a committed editorial snapshot, validated relationship direction, Wikidata property links, Wikipedia articles where available, and reviewed supporting sources. HowConnected branding and the “Explore on HowConnected” link must remain visible.</p>
      </section>

      <section aria-labelledby="widget-limits">
        <h2 id="widget-limits">Pilot limitations</h2>
        <p>The widget does not accept arbitrary searches, query a live graph, expose unpublished daily challenges, support custom styling, or provide publisher dashboards. Unknown and unreviewed identifiers return a not-found response. The pilot collects only aggregate, allowlisted link-click events—no third-party cookies, fingerprinting, personal identifiers, or cross-site activity profiles.</p>
      </section>
    </PublicPageShell>
  );
}
