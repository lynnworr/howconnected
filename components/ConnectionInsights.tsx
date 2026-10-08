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
    <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-[#e3e6eb] bg-white px-5 py-5 text-left md:col-span-2 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ee6243]">
          The explanation
        </p>
        <h3 className="mt-2 text-xl font-bold text-[#1d2944]">
          So, how are they connected?
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#59647a]">
          {generateConnectionExplanation(path)}
        </p>
      </section>

      <section className="rounded-2xl border border-[#e3e6eb] bg-[#f8faf9] px-5 py-5 text-left sm:px-6">
        <h3 className="text-base font-bold text-[#1d2944]">Why this path works</h3>
        <p className="mt-2 text-sm leading-6 text-[#657087]">
          {generateWhyPathWorks(path)}
        </p>
      </section>

      <section className="rounded-2xl border border-[#eadfd8] bg-[#fff8f3] px-5 py-5 text-left sm:px-6">
        <h3 className="text-base font-bold text-[#1d2944]">The fun part</h3>
        <p className="mt-2 text-sm leading-6 text-[#657087]">
          {generateFunTakeaway(path)}
        </p>
      </section>

      <p className="text-center text-xs leading-5 text-[#7b8495] md:col-span-2">
        Follow the source links on each path card to inspect the underlying
        Wikipedia and Wikidata entries.
      </p>
    </div>
  );
}
