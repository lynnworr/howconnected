import WidgetAnalyticsLink from "@/components/WidgetAnalyticsLink";
import type { EmbeddableConnection } from "@/lib/embed-connections";
import { getCanonicalConnectionUrl } from "@/lib/seo";

export default function ConnectionWidget({ data }: { data: EmbeddableConnection }) {
  const { connection, snapshot } = data;
  const canonicalUrl = `${getCanonicalConnectionUrl(connection.canonicalFromQid, connection.canonicalToQid)}?source=publisher_widget`;

  return (
    <main className="hc-widget-shell min-h-screen p-3 sm:p-4">
      <article aria-labelledby="widget-title" className="hc-widget-card mx-auto max-w-3xl rounded-[22px] border p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <WidgetAnalyticsLink
            href="/widgets"
            target="_blank"
            rel="noopener noreferrer"
            connection={connection.slug}
            destination="publisher_info"
            className="inline-flex items-center gap-2 rounded-md text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#1d2944] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
          >
            <span className="hc-widget-mark relative grid size-7 place-items-center rounded-full" aria-hidden="true">
              <span className="absolute left-[6px] size-1.5 rounded-full bg-[#ff795b]" />
              <span className="absolute right-[6px] size-1.5 rounded-full bg-[#58bea0]" />
              <span className="h-px w-3.5 rotate-[-18deg] bg-white/75" />
            </span>
            HowConnected
          </WidgetAnalyticsLink>
          <span className="rounded-full bg-[#e9f8f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#177258]">
            Reviewed connection
          </span>
        </header>

        <h1 id="widget-title" className="mt-4 text-balance text-xl font-extrabold tracking-[-0.03em] text-[#15213b] sm:text-2xl">
          {snapshot.headline}
        </h1>

        <div aria-label={`Connection from ${snapshot.source.label} to ${snapshot.target.label}`} className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          {snapshot.path.nodes.map((node, index) => {
            const relationship = snapshot.path.relationships[index];
            return (
              <div className="contents" key={node.qid}>
                <div role="group" aria-label={`${index === 0 ? "Start" : index === snapshot.path.nodes.length - 1 ? "Connected entity" : "Connecting entity"}: ${node.name}`} className={`hc-widget-node rounded-2xl border px-4 py-3 ${index === 0 ? "hc-widget-node-source" : index === snapshot.path.nodes.length - 1 ? "hc-widget-node-target" : ""}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#818999]">
                    {index === 0 ? "Start" : index === snapshot.path.nodes.length - 1 ? "Connected to" : "Via"}
                  </p>
                  <p className="mt-1 text-sm font-extrabold leading-tight text-[#1d2944]">{node.name}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold">
                    {node.wikipediaUrl ? (
                      <WidgetAnalyticsLink href={node.wikipediaUrl} target="_blank" rel="noopener noreferrer" connection={connection.slug} destination="wikipedia" className="rounded-sm text-[#a4432d] underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">Wikipedia</WidgetAnalyticsLink>
                    ) : null}
                    <WidgetAnalyticsLink href={node.wikidataUrl} target="_blank" rel="noopener noreferrer" connection={connection.slug} destination="wikidata" className="rounded-sm text-[#657087] underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">Wikidata</WidgetAnalyticsLink>
                  </div>
                </div>
                {relationship ? (
                  <div className="flex items-center justify-center gap-2 py-1 text-center text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#a4432d] sm:flex-col sm:px-1" aria-label={`Relationship: ${relationship.label}`}>
                    <span aria-hidden="true" className="h-px min-w-5 flex-1 bg-[#d7dbe0] sm:h-5 sm:w-px sm:min-w-0" />
                    <WidgetAnalyticsLink href={relationship.propertyUrl} target="_blank" rel="noopener noreferrer" connection={connection.slug} destination="evidence" className="rounded-sm underline decoration-[#e4b2a7] underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">{relationship.label}</WidgetAnalyticsLink>
                    <span aria-hidden="true">→</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-[#59647a]">{snapshot.editorialExplanation}</p>

        {snapshot.verificationSources?.length ? (
          <details className="mt-4 rounded-xl border border-[#e1e4e8] bg-white/55 px-3 py-2.5 text-xs text-[#657087]">
            <summary className="cursor-pointer font-bold text-[#1d2944] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">Evidence and context</summary>
            <ul className="mt-2 space-y-2 pl-4">
              {snapshot.verificationSources.map((source) => (
                <li key={source.url} className="list-disc">
                  <WidgetAnalyticsLink href={source.url} target="_blank" rel="noopener noreferrer" connection={connection.slug} destination="evidence" className="font-semibold text-[#a4432d] underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">{source.label}</WidgetAnalyticsLink>
                  <span> — {source.publisher}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe2e5] pt-3">
          <p className="text-[10px] text-[#818999]">Verified {new Date(connection.verifiedAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}</p>
          <WidgetAnalyticsLink href={canonicalUrl} target="_blank" rel="noopener noreferrer" connection={connection.slug} destination="connection" className="rounded-full bg-[#17233f] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ff6846] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]">Explore on HowConnected <span aria-hidden="true">↗</span></WidgetAnalyticsLink>
        </footer>
      </article>
    </main>
  );
}
