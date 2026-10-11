import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import {
  getApprovedExploreConnections,
  getFeaturedExploreConnection,
  type ExploreConnection,
} from "@/lib/explore-connections";
import { SITE_ORIGIN } from "@/lib/seo";

const title = "Explore verified connections | HowConnected";
const description =
  "Explore reviewed connections between influential people and organizations, with clear explanations and links to the underlying evidence.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/explore" },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "HowConnected",
    url: "/explore",
  },
  twitter: { card: "summary", title, description },
};

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ConnectionThread({
  connection,
  featured = false,
}: {
  connection: ExploreConnection;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${featured ? "mt-7" : "mt-5"}`}
      aria-label={`${connection.sourceName} to ${connection.targetName} in ${connection.steps} step${connection.steps === 1 ? "" : "s"}`}
    >
      {connection.path.map((item) => (
        <div className="contents" key={`${connection.slug}-${item.name}`}>
          <span className="hc-explore-node rounded-full border px-3 py-1.5 text-xs font-bold sm:text-sm">
            {item.name}
          </span>
          {item.relationship ? (
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a4432d]">
              <span aria-hidden="true" className="h-px w-4 bg-[#d7dbe0]" />
              {item.relationship}
              <span aria-hidden="true">→</span>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReviewDate({ value }: { value: string }) {
  return (
    <span>
      Reviewed <time dateTime={value}>{formatReviewDate(value)}</time>
    </span>
  );
}

function ConnectionCard({ connection }: { connection: ExploreConnection }) {
  return (
    <article className="hc-explore-card group flex h-full flex-col rounded-[24px] border p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ee6243]">
          Verified connection
        </p>
        <span className="text-[11px] font-semibold text-[#818999]">
          {connection.steps} {connection.steps === 1 ? "step" : "steps"}
        </span>
      </div>
      <h3 className="mt-3 text-balance text-xl font-bold tracking-[-0.025em] text-[#1d2944] sm:text-2xl">
        {connection.sourceName}
        <span aria-hidden="true" className="mx-2 text-[#ff6846]">↔</span>
        {connection.targetName}
      </h3>
      <ConnectionThread connection={connection} />
      <p className="mt-5 flex-1 text-sm leading-6 text-[#657087]">
        {connection.description}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#dfe2e5]/70 pt-4">
        <p className="text-xs text-[#818999]">
          <ReviewDate value={connection.verifiedAt} />
        </p>
        <Link
          href={connection.href}
          className="rounded-full text-sm font-bold text-[#a4432d] underline decoration-[#e4b2a7] underline-offset-4 transition group-hover:text-[#ee6243] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]"
        >
          Follow this connection <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

async function getExplorePageConnections() {
  "use cache";
  cacheLife("days");
  return getApprovedExploreConnections();
}

export default async function ExplorePage() {
  const connections = await getExplorePageConnections();
  const featured = getFeaturedExploreConnection(connections);
  const remaining = connections.filter(({ slug }) => slug !== featured?.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Explore verified connections",
    description,
    url: `${SITE_ORIGIN}/explore`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: connections.length,
      itemListElement: connections.map((connection, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: connection.canonicalUrl,
        name: `${connection.sourceName} and ${connection.targetName}`,
        description: connection.description,
      })),
    },
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

        <div className="mx-auto w-full max-w-6xl flex-1 py-14 sm:py-20">
          <header className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">
              Curated threads
            </p>
            <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] text-[#15213b] sm:text-6xl">
              Explore connections worth following.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#657087] sm:text-lg sm:leading-8">
              Start with relationships reviewed against committed evidence. Each path below is a verified snapshot—not a claim inferred from a live search.
            </p>
          </header>

          {featured ? (
            <section className="mt-12" aria-labelledby="featured-connection">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">
                    Editor’s pick
                  </p>
                  <h2 id="featured-connection" className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#1d2944]">
                    Featured verified connection
                  </h2>
                </div>
                <p className="hidden text-xs text-[#818999] sm:block">
                  <ReviewDate value={featured.verifiedAt} />
                </p>
              </div>

              <article className="hc-explore-feature relative overflow-hidden rounded-[30px] border p-6 sm:p-9">
                <div className="relative z-10 max-w-4xl">
                  <p className="text-xs font-bold text-[#177258]">Evidence-backed · {featured.steps} step</p>
                  <h3 className="mt-3 text-balance text-3xl font-extrabold tracking-[-0.04em] text-[#15213b] sm:text-5xl">
                    {featured.sourceName}
                    <span aria-hidden="true" className="mx-3 text-[#ff6846]">↔</span>
                    {featured.targetName}
                  </h3>
                  <ConnectionThread connection={featured} featured />
                  <p className="mt-6 max-w-3xl text-base leading-7 text-[#59647a] sm:text-lg sm:leading-8">
                    {featured.description}
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <Link
                      href={featured.href}
                      className="hc-primary-button inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]"
                    >
                      See the evidence <span aria-hidden="true" className="ml-2">→</span>
                    </Link>
                    <p className="text-xs text-[#818999] sm:hidden">
                      <ReviewDate value={featured.verifiedAt} />
                    </p>
                  </div>
                </div>
              </article>
            </section>
          ) : null}

          {remaining.length > 0 ? (
            <section className="mt-14" aria-labelledby="verified-connections">
              <div className="max-w-2xl">
                <h2 id="verified-connections" className="text-2xl font-bold tracking-[-0.03em] text-[#1d2944] sm:text-3xl">
                  More verified connections
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657087] sm:text-base">
                  Browse the current collection. New paths appear here only after their snapshots and wording pass editorial review.
                </p>
              </div>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {remaining.map((connection) => (
                  <ConnectionCard connection={connection} key={connection.slug} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="hc-explore-next mt-14 rounded-[26px] border px-6 py-7 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8" aria-labelledby="keep-exploring">
            <div>
              <h2 id="keep-exploring" className="text-xl font-bold text-[#1d2944]">
                Follow your own thread
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657087]">
                Search for any two entities, or let Surprise Me choose a starting point. Live discoveries remain separate from this reviewed collection.
              </p>
            </div>
            <div className="mt-5 flex shrink-0 flex-wrap gap-3 sm:mt-0">
              <Link href="/" className="hc-primary-button inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]">
                Start a search
              </Link>
              <Link href="/#surprise-me" className="hc-secondary-button inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]">
                Surprise me
              </Link>
            </div>
          </section>
        </div>

        <PublicFooter />
      </div>
    </main>
  );
}
