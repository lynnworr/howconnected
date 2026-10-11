import type { ConnectionPathData } from "@/components/connection-types";
import type { EditorialPageDetails } from "@/lib/connection-page-state";
import {
  generateConnectionExplanation,
  generateFunTakeaway,
  generateWhyPathWorks,
} from "@/lib/path-content";

export default function ConnectionInsights({
  path,
  editorial,
}: {
  path: ConnectionPathData;
  editorial?: EditorialPageDetails;
}) {
  const evidenceRelationships = path.relationships.filter(
    (relationship) => relationship.propertyId && relationship.propertyUrl,
  );

  return (
    <div className="mx-auto mt-5 grid max-w-[68rem] gap-3 border-t border-[#e4e6e9] pt-5 md:grid-cols-2">
      <section className="px-1 text-left md:col-span-2 sm:px-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ee6243]">
          The explanation
        </p>
        <h3 className="mt-1.5 text-xl font-bold text-[#1d2944]">
          So, how are they connected?
        </h3>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-[#59647a] sm:text-[15px] sm:leading-7">
          {editorial?.explanation ?? generateConnectionExplanation(path)}
        </p>
      </section>

      <section className="rounded-xl bg-[#f1f6f3]/80 px-4 py-4 text-left sm:px-5">
        <h3 className="text-base font-bold text-[#1d2944]">Why this path works</h3>
        <p className="mt-2 text-sm leading-6 text-[#657087]">
          {generateWhyPathWorks(path)}
        </p>
      </section>

      <section className="rounded-xl bg-[#fff4ee]/75 px-4 py-4 text-left sm:px-5">
        <h3 className="text-base font-bold text-[#1d2944]">The fun part</h3>
        <p className="mt-2 text-sm leading-6 text-[#657087]">
          {generateFunTakeaway(path)}
        </p>
      </section>

      {evidenceRelationships.length > 0 ? (
        <section className="rounded-xl border border-[#e4e6e9] bg-white/55 px-4 py-4 text-left md:col-span-2 sm:px-5">
          <h3 className="text-base font-bold text-[#1d2944]">Evidence and context</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#657087]">
            {evidenceRelationships.map((relationship, index) => (
              <li key={`${relationship.propertyId}-${index}`}>
                <span className="font-semibold text-[#37435c]">
                  {relationship.from} {relationship.label} {relationship.to}
                </span>{" "}
                <a
                  href={relationship.propertyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm underline underline-offset-2 hover:text-[#b74a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
                >
                  Wikidata {relationship.propertyId}
                </a>
                {relationship.qualifiers?.length ? (
                  <span>
                    {" "}({relationship.qualifiers.map((item) => `${item.label}: ${item.value}`).join("; ")})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {editorial ? (
            <p className="mt-3 text-xs leading-5 text-[#7b8495]">
              Editorial snapshot verified{" "}
              <time dateTime={editorial.verifiedAt}>
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(editorial.verifiedAt))}
              </time>
              .
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="mt-1 text-center text-[11px] leading-5 text-[#858c99] md:col-span-2">
        Follow the source links on each path card to inspect the underlying
        Wikipedia and Wikidata entries.
      </p>
    </div>
  );
}
