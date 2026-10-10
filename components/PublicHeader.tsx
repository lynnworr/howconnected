import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function PublicHeader() {
  return (
    <header className="hc-public-header flex items-center justify-between gap-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]"
        aria-label="Go to HowConnected home"
      >
        <span className="hc-logo relative grid size-8 place-items-center rounded-full">
          <span className="absolute left-[7px] size-1.5 rounded-full bg-[#ff795b]" />
          <span className="absolute right-[7px] size-1.5 rounded-full bg-[#58bea0]" />
          <span className="h-px w-4 rotate-[-18deg] bg-white/75" />
        </span>
        <span className="hc-brand text-sm font-extrabold uppercase tracking-[0.18em]">
          HowConnected
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hc-header-note hidden rounded-full border px-3 py-1.5 text-[11px] font-semibold md:inline-flex">
          Follow the thread
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
