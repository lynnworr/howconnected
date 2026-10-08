import type { ConnectionPathData } from "@/components/connection-types";
import {
  generateConnectionExplanation,
  generateFunTakeaway,
  generateWhyPathWorks,
} from "@/lib/path-content";

export default function ConnectionInsights({
  path,
}: {
  path: ConnectionPathData;
}) {
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
          {generateConnectionExplanation(path)}
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

      <p className="mt-1 text-center text-[11px] leading-5 text-[#858c99] md:col-span-2">
        Follow the source links on each path card to inspect the underlying
        Wikipedia and Wikidata entries.
      </p>
    </div>
  );
}
