import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import ConnectionOutcomeAnalytics from "@/components/ConnectionOutcomeAnalytics";
import ConnectionResult from "@/components/ConnectionResult";
import PublicFooter from "@/components/PublicFooter";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicHeader from "@/components/PublicHeader";
import type { ConnectionPageData } from "@/lib/connection-page-data";
import { getConnectionPageData } from "@/lib/connection-page-data";
import { buildConnectionRouteMetadata } from "@/lib/connection-seo";
import { getConnectionPath } from "@/lib/connection-share";
import { isValidQid } from "@/lib/wikidata-id";

type ConnectPageProps = {
  params: Promise<{ fromQid: string; toQid: string }>;
};

export async function generateMetadata({
  params,
}: ConnectPageProps): Promise<Metadata> {
  await connection();
  const { fromQid, toQid } = await params;
  return buildConnectionRouteMetadata(fromQid, toQid);
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="hc-public relative min-h-screen overflow-hidden">
      <NetworkBackdrop />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-5 sm:px-7 lg:px-10">
        <PublicHeader />

        <div className="flex flex-1 flex-col justify-center py-12">{children}</div>

        <PublicFooter />
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
  } else if (data.status === "editorial-unavailable") {
    title = "This verified connection is temporarily unavailable.";
    message =
      "Its reviewed snapshot needs attention before it can be published again. Try another connection for now.";
  } else if (data.status === "same") {
    title = "Choose two different entities.";
    message = `${data.source.label} can't be connected to itself here.`;
  } else if (data.status === "empty") {
    if (data.result.timedOut) {
      title = "That search took too long.";
      message = "The connection search reached its time limit. Try again or choose another pair.";
    } else {
      title = "We couldn't find a strong connection yet.";
      message = `Our knowledge graph doesn't have a meaningful path from ${data.source.label} to ${data.target.label} yet.`;
    }
  }

  return (
    <section className="hc-panel mx-auto w-full max-w-xl rounded-[28px] border px-6 py-10 text-center">
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

async function ConnectionPageContent({
  fromQid,
  toQid,
}: {
  fromQid: string;
  toQid: string;
}) {
  const data = await getConnectionPageData(fromQid, toQid);

  if (data.status !== "success") {
    const event =
      data.status === "empty"
        ? data.result.timedOut
          ? "search_timed_out"
          : "search_no_reliable_path"
        : data.status === "error"
          ? "search_failed"
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
      editorial={data.editorial}
    />
  );
}

function ConnectionLoading() {
  return (
    <section
      className="hc-panel mx-auto w-full max-w-3xl rounded-[28px] border px-6 py-10 text-center shadow-[0_20px_70px_rgba(20,30,50,0.08)]"
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

export default async function ConnectPage({ params }: ConnectPageProps) {
  const rawParams = await params;
  const fromQid = rawParams.fromQid.trim().toUpperCase();
  const toQid = rawParams.toQid.trim().toUpperCase();
  if (!isValidQid(fromQid) || !isValidQid(toQid)) notFound();

  return (
    <PageFrame>
      <Suspense fallback={<ConnectionLoading />}>
        <ConnectionPageContent fromQid={fromQid} toQid={toQid} />
      </Suspense>
    </PageFrame>
  );
}
