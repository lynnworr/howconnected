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
      <nav aria-label="Primary navigation" className="hidden md:block">
        <ul className="flex items-center gap-1">
          <li>
            <Link href="/daily" className="hc-nav-link rounded-full px-4 py-2 text-sm font-bold text-[#59647a] transition hover:text-[#b44730] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">
              Daily challenge
            </Link>
          </li>
          <li>
            <Link
              href="/methodology"
              className="hc-nav-link rounded-full px-4 py-2 text-sm font-bold text-[#59647a] transition hover:text-[#b44730] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
            >
              Methodology
            </Link>
          </li>
          <li>
            <Link
              href="/explore"
              className="hc-nav-link rounded-full px-4 py-2 text-sm font-bold text-[#59647a] transition hover:text-[#b44730] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
            >
              Explore
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              className="hc-nav-link rounded-full px-4 py-2 text-sm font-bold text-[#59647a] transition hover:text-[#b44730] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
            >
              About
            </Link>
          </li>
        </ul>
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
        <nav aria-label="Mobile navigation" className="flex items-center md:hidden">
          <Link href="/daily" className="hc-header-note inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">
            Daily
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
