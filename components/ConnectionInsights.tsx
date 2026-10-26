import Link from "next/link";
import type { ConnectionPathData } from "@/components/connection-types";
import type { EditorialPageDetails } from "@/lib/connection-page-state";
import type {
  EditorialEvidenceRole,
  EditorialFreshness,
  EditorialSource,
} from "@/lib/editorial-connections";
import {
  generateConnectionExplanation,
  generateFunTakeaway,
  generateWhyPathWorks,
} from "@/lib/path-content";

const EVIDENCE_ROLE_LABELS: Record<EditorialEvidenceRole, string> = {
  "structured-claim": "Structured graph record",
  "primary-source": "Primary or official source",
  "independent-corroboration": "Independent corroboration",
  "context-source": "Context source",
};

const FRESHNESS_LABELS: Record<EditorialFreshness, string> = {
  historical: "Historical claim",
  periodic: "Checked periodically",
  "current-role": "Current role — recheck regularly",
  "time-sensitive": "Time-sensitive claim",
};

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function EvidenceSourceCard({ source }: { source: EditorialSource }) {
  const role = source.evidenceRole
    ? EVIDENCE_ROLE_LABELS[source.evidenceRole]
    : "Verification source";

  return (
    <li className="hc-editorial-source rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`hc-evidence-role hc-evidence-role-${source.evidenceRole ?? "unclassified"} rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.11em]`}>
          {role}
        </span>
        {source.freshness ? (
          <span className="text-[11px] font-semibold text-[#7b8495]">
            {FRESHNESS_LABELS[source.freshness]}
          </span>
        ) : null}
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex rounded-sm text-sm font-bold text-[#37435c] underline decoration-[#d8a99e] underline-offset-4 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
      >
        {source.label}
        <span aria-hidden="true" className="ml-1">↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <p className="mt-1 text-xs font-semibold text-[#7b8495]">{source.publisher}</p>
      {source.supports?.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#a4432d]">
            Used to support
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-[#657087]">
            {source.supports.map((claim) => <li key={claim}>{claim}</li>)}
          </ul>
        </div>
      ) : null}
      {source.reviewedAt ? (
        <p className="mt-3 text-[11px] leading-5 text-[#818999]">
          Source reviewed <time dateTime={source.reviewedAt}>{formatReviewDate(source.reviewedAt)}</time>
        </p>
      ) : null}
    </li>
  );
}

function EditorialInsights({
  path,
  editorial,
}: {
  path: ConnectionPathData;
  editorial: EditorialPageDetails;
}) {
  const evidenceRelationships = path.relationships.filter(
    (relationship) => relationship.propertyId && relationship.propertyUrl,
  );

  return (
    <article className="mx-auto mt-6 max-w-[68rem] border-t border-[#e4e6e9] pt-6">
      <section className="hc-editorial-synthesis rounded-[22px] border p-5 text-left sm:p-7" aria-labelledby="editorial-synthesis-heading">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#a4432d]">Editorial interpretation</p>
        <h2 id="editorial-synthesis-heading" className="mt-2 text-balance text-xl font-bold tracking-[-0.025em] text-[#1d2944] sm:text-2xl">
          What connects them—and why it matters
        </h2>
        <p className="mt-3 max-w-5xl text-sm leading-7 text-[#59647a] sm:text-base">
          {editorial.explanation}
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="hc-editorial-card rounded-[20px] border p-5 text-left sm:p-6" aria-labelledby="graph-record-heading">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#177258]">Structured graph</p>
          <h2 id="graph-record-heading" className="mt-2 text-lg font-bold text-[#1d2944]">How the relationship is recorded</h2>
          <p className="mt-2 text-sm leading-6 text-[#657087]">{editorial.relationshipMeaning}</p>
        </section>

        {editorial.context.length ? (
          <section className="hc-editorial-card rounded-[20px] border p-5 text-left sm:p-6" aria-labelledby="historical-context-heading">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a4432d]">Reviewed context</p>
            <h2 id="historical-context-heading" className="mt-2 text-lg font-bold text-[#1d2944]">The context that changes the meaning</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#657087]">
              {editorial.context.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}
      </div>

      {editorial.limitations.length ? (
        <section className="hc-editorial-limits mt-4 rounded-[20px] border px-5 py-5 text-left sm:px-6" aria-labelledby="relationship-limits-heading">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full text-lg font-black">≠</span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a4432d]">Boundaries and misconceptions</p>
              <h2 id="relationship-limits-heading" className="mt-1.5 text-lg font-bold text-[#1d2944]">What this connection does not prove</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#657087]">
                {editorial.limitations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {evidenceRelationships.length || editorial.verificationSources.length ? (
        <details className="hc-editorial-evidence group mt-4 rounded-[20px] border text-left">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846] sm:px-6">
            <span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#177258]">Evidence trail</span>
              <span className="mt-1 block text-base font-bold text-[#1d2944] sm:text-lg">Examine the graph statements and sources</span>
              <span className="mt-1 block text-xs leading-5 text-[#657087]">
                {evidenceRelationships.length} graph {evidenceRelationships.length === 1 ? "statement" : "statements"} · {editorial.verificationSources.length} reviewed {editorial.verificationSources.length === 1 ? "source" : "sources"}
              </span>
            </span>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full text-xl font-light transition-transform group-open:rotate-45">+</span>
          </summary>

          <div className="border-t border-[#e4e6e9] px-5 py-5 sm:px-6 sm:py-6">
            {evidenceRelationships.length ? (
              <section aria-labelledby="structured-statements-heading">
                <h3 id="structured-statements-heading" className="text-base font-bold text-[#1d2944]">Structured statements</h3>
                <p className="mt-1 text-xs leading-5 text-[#7b8495]">These properties establish the displayed graph path. They are not, by themselves, the full editorial explanation.</p>
                <ul className="mt-3 space-y-3">
                  {evidenceRelationships.map((relationship, index) => (
                    <li key={`${relationship.propertyId}-${index}`} className="hc-editorial-statement rounded-xl border px-4 py-3 text-sm leading-6 text-[#657087]">
                      <span className="font-semibold text-[#37435c]">{relationship.from} {relationship.label} {relationship.to}</span>{" "}
                      <a href={relationship.propertyUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm font-semibold underline underline-offset-3 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">
                        Wikidata {relationship.propertyId}
                      </a>
                      {relationship.qualifiers?.length ? (
                        <span className="block text-xs leading-5 text-[#7b8495]">Qualifiers: {relationship.qualifiers.map((item) => `${item.label}: ${item.value}`).join("; ")}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {editorial.verificationSources.length ? (
              <section className={evidenceRelationships.length ? "mt-7" : ""} aria-labelledby="reviewed-sources-heading">
                <h3 id="reviewed-sources-heading" className="text-base font-bold text-[#1d2944]">Reviewed sources and what they support</h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-[#7b8495]">Source roles separate the structured graph record from official accounts, independent corroboration, and contextual material.</p>
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {editorial.verificationSources.map((source) => <EvidenceSourceCard source={source} key={source.url} />)}
                </ul>
              </section>
            ) : null}

            <p className="mt-6 text-xs leading-5 text-[#7b8495]">
              Page last reviewed <time dateTime={editorial.verifiedAt}>{formatReviewDate(editorial.verifiedAt)}</time>.{" "}
              Read the <Link href="/methodology" className="rounded-sm font-semibold underline underline-offset-3 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">editorial methodology</Link> or <Link href="/contact" className="rounded-sm font-semibold underline underline-offset-3 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">report a concern</Link>.
            </p>
          </div>
        </details>
      ) : null}
    </article>
  );
}

function LiveInsights({ path }: { path: ConnectionPathData }) {
  const evidenceRelationships = path.relationships.filter(
    (relationship) => relationship.propertyId && relationship.propertyUrl,
  );

  return (
    <div className="mx-auto mt-5 grid max-w-[68rem] gap-3 border-t border-[#e4e6e9] pt-5 md:grid-cols-2">
      <section className="px-1 text-left md:col-span-2 sm:px-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ee6243]">The explanation</p>
        <h2 className="mt-1.5 text-xl font-bold text-[#1d2944]">So, how are they connected?</h2>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-[#59647a] sm:text-[15px] sm:leading-7">{generateConnectionExplanation(path)}</p>
      </section>

      <section className="rounded-xl bg-[#f1f6f3]/80 px-4 py-4 text-left sm:px-5">
        <h3 className="text-base font-bold text-[#1d2944]">Why this path works</h3>
        <p className="mt-2 text-sm leading-6 text-[#657087]">{generateWhyPathWorks(path)}</p>
      </section>

      <section className="rounded-xl bg-[#fff4ee]/75 px-4 py-4 text-left sm:px-5">
        <h3 className="text-base font-bold text-[#1d2944]">The fun part</h3>
        <p className="mt-2 text-sm leading-6 text-[#657087]">{generateFunTakeaway(path)}</p>
      </section>

      {evidenceRelationships.length ? (
        <section className="rounded-xl border border-[#e4e6e9] bg-white/55 px-4 py-4 text-left md:col-span-2 sm:px-5">
          <h3 className="text-base font-bold text-[#1d2944]">Graph evidence</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#657087]">
            {evidenceRelationships.map((relationship, index) => (
              <li key={`${relationship.propertyId}-${index}`}>
                <span className="font-semibold text-[#37435c]">{relationship.from} {relationship.label} {relationship.to}</span>{" "}
                <a href={relationship.propertyUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm underline underline-offset-2 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">Wikidata {relationship.propertyId}</a>
                {relationship.qualifiers?.length ? <span>{" "}({relationship.qualifiers.map((item) => `${item.label}: ${item.value}`).join("; ")})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-1 text-center text-[11px] leading-5 text-[#858c99] md:col-span-2">
        Live graph results are not editorially verified. Follow the entity and property links to inspect the underlying Wikipedia and Wikidata records.
      </p>
    </div>
  );
}

export default function ConnectionInsights({
  path,
  editorial,
}: {
  path: ConnectionPathData;
  editorial?: EditorialPageDetails;
}) {
  return editorial
    ? <EditorialInsights path={path} editorial={editorial} />
    : <LiveInsights path={path} />;
}
