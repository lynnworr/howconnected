import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import AnalyticsLink from "@/components/AnalyticsLink";
import ConnectionExplorer from "@/components/ConnectionExplorer";
import PublicFooter from "@/components/PublicFooter";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicHeader from "@/components/PublicHeader";
import SurpriseMe from "@/components/SurpriseMe";
import TrendingConnections from "@/components/TrendingConnections";
import { createConnectionRecommendationCatalog } from "@/lib/connection-recommendations";
import {
  getApprovedExploreConnections,
  getHomepageDiscoveryConnections,
} from "@/lib/explore-connections";
import { SITE_ORIGIN } from "@/lib/seo";
import { getSpoilerSafeSurprisePairs } from "@/lib/surprise-pairs";
import { getHomepageTrendingConnections } from "@/lib/trending-connections";

const title = "HowConnected — Discover surprising real-world connections";
const description =
  "Choose two people, companies, places, teams, works, or ideas to discover a meaningful relationship path, then inspect the underlying evidence.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "HowConnected",
    url: "/",
  },
  twitter: { card: "summary", title, description },
};

async function getHomepageConnections() {
  "use cache";
  cacheLife("hours");
  return {
    discovery: getHomepageDiscoveryConnections(),
    recommendationCatalog: createConnectionRecommendationCatalog(
      getApprovedExploreConnections(),
    ),
    surprisePairs: getSpoilerSafeSurprisePairs(),
    trending: getHomepageTrendingConnections(),
  };
}

export default async function Home() {
  const { discovery: discoveryConnections, recommendationCatalog, surprisePairs, trending } =
    await getHomepageConnections();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HowConnected",
    url: SITE_ORIGIN,
    description,
    inLanguage: "en",
  };

  return (
    <main className="hc-public relative min-h-screen overflow-hidden">
      <NetworkBackdrop />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-5 sm:px-7 lg:px-10">
        <PublicHeader />

        <section className="hc-hero flex flex-1 flex-col items-center pt-20 text-center sm:pt-24 lg:pt-28">
          <div className="hc-eyebrow inline-flex items-center gap-2 rounded-full border border-[#e3ded3] bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#687186] shadow-sm backdrop-blur">
            <span className="size-1.5 rounded-full bg-[#ff6846]" />
            Explore unexpected connections
          </div>
          <h1 className="hc-hero-title mt-6 max-w-4xl text-balance text-[clamp(3rem,8vw,6.9rem)] font-extrabold leading-[0.9] tracking-[-0.072em] text-[#15213b]">
            Everything is{" "}
            <span className="hc-coral relative whitespace-nowrap text-[#ff6846]">
              connected.
              <svg aria-hidden="true" className="absolute -bottom-2 left-1/2 h-3 w-[92%] -translate-x-1/2 text-[#f2b84a]" viewBox="0 0 320 18" fill="none" preserveAspectRatio="none">
                <path d="M3 13C76 2 223 3 317 10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="hc-hero-copy mt-8 max-w-2xl text-balance text-base leading-7 text-[#657087] sm:text-lg">
            Pick any two people, companies, places, teams, works, or ideas and discover how they connect.
          </p>

          <section className="mt-7 w-full max-w-4xl" aria-labelledby="how-it-works">
            <h2 id="how-it-works" className="sr-only">How HowConnected works</h2>
            <ol className="hc-how-it-works grid gap-2 rounded-2xl border p-3 text-left sm:grid-cols-3 sm:p-4">
              <li className="flex items-start gap-3 rounded-xl px-2 py-2">
                <span className="hc-step-number grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold">1</span>
                <span className="text-xs leading-5 text-[#657087]"><strong className="block text-[#26334f]">Choose two entities</strong>People, places, organizations, works, teams, or ideas.</span>
              </li>
              <li className="flex items-start gap-3 rounded-xl px-2 py-2">
                <span className="hc-step-number grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold">2</span>
                <span className="text-xs leading-5 text-[#657087]"><strong className="block text-[#26334f]">Follow the evidence</strong>We search for meaningful, evidence-backed relationships.</span>
              </li>
              <li className="flex items-start gap-3 rounded-xl px-2 py-2">
                <span className="hc-step-number grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold">3</span>
                <span className="text-xs leading-5 text-[#657087]"><strong className="block text-[#26334f]">Explore the sources</strong>See the path, explanation, and underlying references.</span>
              </li>
            </ol>
          </section>

          <section className="mt-9 w-full max-w-5xl text-left" aria-labelledby="reviewed-starts">
            <div className="text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">No search required</p>
              <h2 id="reviewed-starts" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#1d2944] sm:text-3xl">Start with a reviewed connection</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#657087]">Open an editor-reviewed path backed by committed evidence and source links.</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {discoveryConnections.map((connection) => (
                <article key={connection.slug} className="hc-discovery-card group flex h-full flex-col rounded-[20px] border p-4 sm:p-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#177258]">{connection.category}</p>
                  <h3 className="mt-2 text-base font-bold leading-6 text-[#1d2944]">{connection.headline}</h3>
                  <p className="mt-3 flex-1 text-xs leading-5 text-[#657087]">{connection.sourceName} <span aria-hidden="true" className="text-[#ee6243]">→</span> {connection.targetName} · {connection.steps} {connection.steps === 1 ? "step" : "steps"}</p>
                  <AnalyticsLink
                    href={connection.href}
                    event="homepage_example_opened"
                    eventProperties={{ connection: connection.slug, category: connection.category }}
                    className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 group-hover:text-[#ee6243] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
                  >
                    Open connection <span aria-hidden="true" className="ml-1">→</span>
                  </AnalyticsLink>
                </article>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <AnalyticsLink href="/explore" event="homepage_discovery_interacted" eventProperties={{ action: "view_all_reviewed" }} className="hc-secondary-button inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">View all reviewed connections</AnalyticsLink>
              <AnalyticsLink href="/#search" event="homepage_discovery_interacted" eventProperties={{ action: "search_own_pair" }} className="rounded-full px-4 py-2.5 text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">Search your own pair</AnalyticsLink>
            </div>
          </section>

          <ConnectionExplorer recommendationCatalog={recommendationCatalog} />
          <TrendingConnections connections={trending} />
          <SurpriseMe pairs={surprisePairs} />
          <section className="mt-10 w-full max-w-5xl text-left" aria-labelledby="learn-with-howconnected">
            <h2 id="learn-with-howconnected" className="text-center text-2xl font-bold tracking-[-0.03em] text-[#1d2944]">
              Follow a connection further
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-[#657087]">
              Search the live knowledge graph, start with an editor-reviewed path, or test what you know in a verified daily challenge.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <article className="hc-explore-card rounded-[20px] border p-5">
                <h3 className="text-base font-bold text-[#1d2944]">Read reviewed connections</h3>
                <p className="mt-2 text-sm leading-6 text-[#657087]">Browse concise explanations with historical context and relationship-specific sources.</p>
                <Link href="/explore" className="mt-4 inline-flex rounded-sm text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]">Explore verified paths</Link>
              </article>
              <article className="hc-explore-card rounded-[20px] border p-5">
                <h3 className="text-base font-bold text-[#1d2944]">Find today&apos;s missing link</h3>
                <p className="mt-2 text-sm leading-6 text-[#657087]">Choose the hidden intermediary, then open the verified Wikipedia articles and evidence.</p>
                <Link href="/daily" className="mt-4 inline-flex rounded-sm text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]">Play The Missing Link</Link>
              </article>
              <article className="hc-explore-card rounded-[20px] border p-5">
                <h3 className="text-base font-bold text-[#1d2944]">See how claims are checked</h3>
                <p className="mt-2 text-sm leading-6 text-[#657087]">Learn how Wikidata statements, direction, dates, qualifiers, and sources become a reviewed path.</p>
                <Link href="/methodology" className="mt-4 inline-flex rounded-sm text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]">Read the methodology</Link>
              </article>
            </div>
          </section>
        </section>

        <PublicFooter />
      </div>
    </main>
  );
}
