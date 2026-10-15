import type { Metadata } from "next";
import Link from "next/link";
import ConnectionExplorer from "@/components/ConnectionExplorer";
import PublicFooter from "@/components/PublicFooter";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicHeader from "@/components/PublicHeader";
import SurpriseMe from "@/components/SurpriseMe";
import { SITE_ORIGIN } from "@/lib/seo";

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

export default function Home() {
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

          <ConnectionExplorer />
          <SurpriseMe />
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
