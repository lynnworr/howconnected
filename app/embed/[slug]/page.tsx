import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import ConnectionWidget from "@/components/ConnectionWidget";
import { getEmbeddableConnection, getEmbeddableConnections } from "@/lib/embed-connections";
import { getCanonicalConnectionUrl } from "@/lib/seo";

type EmbedPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getEmbeddableConnections().map(({ connection }) => ({ slug: connection.slug }));
}

async function getCachedEmbeddableConnection(slug: string) {
  "use cache";
  cacheLife("days");
  return getEmbeddableConnection(slug);
}

export async function generateMetadata({ params }: EmbedPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCachedEmbeddableConnection(slug);
  if (!data) return { title: "Connection unavailable | HowConnected", robots: { index: false, follow: false } };
  return {
    title: `${data.snapshot.source.label} to ${data.snapshot.target.label} | HowConnected widget`,
    description: data.snapshot.editorialExplanation,
    robots: { index: false, follow: true },
    alternates: { canonical: getCanonicalConnectionUrl(data.connection.canonicalFromQid, data.connection.canonicalToQid) },
  };
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { slug } = await params;
  const data = await getCachedEmbeddableConnection(slug);
  if (!data) notFound();
  return <ConnectionWidget data={data} />;
}
