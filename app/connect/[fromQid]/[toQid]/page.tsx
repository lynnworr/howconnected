import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import ConnectionOutcomeAnalytics from "@/components/ConnectionOutcomeAnalytics";
import ConnectionResult from "@/components/ConnectionResult";
import type { ConnectionPageData } from "@/lib/connection-page-data";
import { getConnectionPageData } from "@/lib/connection-page-data";
import { getConnectionPath } from "@/lib/connection-share";

type ConnectPageProps = {
  params: Promise<{ fromQid: string; toQid: string }>;
};

function metadataForState(data: ConnectionPageData): Metadata {
  if (data.status === "success" && data.result.bestPath) {
    const title = `How are ${data.source.label} and ${data.target.label} connected? | HowConnected`;
    const description = `Discover the ${data.result.bestPath.steps}-step connection between ${data.source.label} and ${data.target.label}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "HowConnected",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  }

  const namedPair =
    data.status === "empty" || data.status === "same"
      ? `${data.source.label} and ${data.target.label}`
      : "this connection";
  const title = `Explore ${namedPair} | HowConnected`;
  const description = `No meaningful connection is currently available for ${namedPair}.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "HowConnected" },
    twitter: { card: "summary", title, description },
  };
}

export async function generateMetadata({
  params,
}: ConnectPageProps): Promise<Metadata> {
  await connection();
  const { fromQid, toQid } = await params;
  return metadataForState(await getConnectionPageData(fromQid, toQid));
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f5ef] text-[#15213b]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(255,190,130,0.28),transparent_28%),radial-gradient(circle_at_90%_25%,rgba(102,190,163,0.2),transparent_25%),linear-gradient(180deg,#fbfaf6_0%,#f5f3ed_100%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-5 sm:px-7 lg:px-10">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]"
            aria-label="HowConnected home"
          >
            <span className="relative grid size-8 place-items-center rounded-full bg-[#17233f]">
              <span className="absolute left-[7px] size-1.5 rounded-full bg-[#ff795b]" />
              <span className="absolute right-[7px] size-1.5 rounded-full bg-[#58bea0]" />
              <span className="h-px w-4 rotate-[-18deg] bg-white/75" />
            </span>
            <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#26334f]">
              HowConnected
            </span>
          </Link>
          <span className="hidden rounded-full border border-[#dce0e6] bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-[#667086] sm:inline-flex">
            Follow the thread
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">{children}</div>

        <footer className="mt-12 flex items-center justify-center border-t border-[#dfe2e5]/70 pt-6 text-center text-xs text-[#818999]">
          Curiosity has no dead ends.
        </footer>
      </div>
    </main>
  );
}

function FriendlyState({ data }: { data: ConnectionPageData }) {
  let title = "We couldn't complete that connection.";
  let message = "Something got in the way. Please try again in a moment.";

  if (data.status === "invalid") {
    title = "That connection link isn't valid.";
    message = "Choose two entities from the homepage to create a new connection link.";
  } else if (data.status === "same") {
    title = "Choose two different entities.";
    message = `${data.source.label} can't be connected to itself here.`;
  } else if (data.status === "empty") {
    title = "We couldn't find a strong connection yet.";
    message = `Our knowledge graph doesn't have a meaningful path from ${data.source.label} to ${data.target.label} yet.`;
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-[28px] border border-[#eadfd8] bg-[#fffaf6] px-6 py-10 text-center shadow-[0_18px_60px_rgba(30,35,50,0.07)]">
      <span className="text-3xl" aria-hidden="true">⌁</span>
      <h1 className="mt-3 text-2xl font-bold text-[#192541]">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f7889]">{message}</p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full bg-[#17233f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#ff6846] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
      >
        Try another connection
      </Link>
    </section>
  );
}

async function ConnectionPageContent({ params }: ConnectPageProps) {
  await connection();
  const { fromQid, toQid } = await params;
  const data = await getConnectionPageData(fromQid, toQid);

  if (data.status !== "success") {
    const event =
      data.status === "empty"
        ? "connection_no_result"
        : data.status === "error"
          ? "connection_error"
          : null;

    return (
      <>
        {event ? (
          <ConnectionOutcomeAnalytics
            event={event}
            fromQid={fromQid.trim().toUpperCase()}
            toQid={toQid.trim().toUpperCase()}
            origin="shared_url"
          />
        ) : null}
        <FriendlyState data={data} />
      </>
    );
  }

  return (
    <ConnectionResult
      result={data.result}
      share={{
        sourceName: data.source.label,
        targetName: data.target.label,
        path: getConnectionPath(data.source.id, data.target.id),
      }}
    />
  );
}

function ConnectionLoading() {
  return (
    <section
      className="mx-auto w-full max-w-3xl rounded-[28px] border border-[#e1e5eb] bg-white/80 px-6 py-10 text-center shadow-[0_20px_70px_rgba(20,30,50,0.08)]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto flex w-fit items-center gap-3" aria-hidden="true">
        <span className="size-3 animate-pulse rounded-full bg-[#ff6846]" />
        <span className="size-3 animate-pulse rounded-full bg-[#f3b84b]" />
        <span className="size-3 animate-pulse rounded-full bg-[#42ad8d]" />
      </div>
      <p className="mt-5 text-base font-bold text-[#24304b]">Finding this connection...</p>
    </section>
  );
}

export default function ConnectPage({ params }: ConnectPageProps) {
  return (
    <PageFrame>
      <Suspense fallback={<ConnectionLoading />}>
        <ConnectionPageContent params={params} />
      </Suspense>
    </PageFrame>
  );
}
