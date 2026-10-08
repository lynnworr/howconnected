import type { Metadata } from "next";
import ConnectionExplorer from "@/components/ConnectionExplorer";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f5ef] text-[#15213b]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(255,190,130,0.28),transparent_28%),radial-gradient(circle_at_90%_25%,rgba(102,190,163,0.2),transparent_25%),linear-gradient(180deg,#fbfaf6_0%,#f5f3ed_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-[8%] top-36 hidden md:block">
        <div className="size-2 rounded-full bg-[#ff6846] shadow-[82px_46px_0_#f3b84b,145px_-18px_0_#4cae91]" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-52 hidden md:block">
        <div className="size-2 rounded-full bg-[#4cae91] shadow-[-70px_-44px_0_#ff6846,-145px_25px_0_#f3b84b]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-5 sm:px-7 lg:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]" aria-label="HowConnected home">
            <span className="relative grid size-8 place-items-center rounded-full bg-[#17233f]">
              <span className="absolute left-[7px] size-1.5 rounded-full bg-[#ff795b]" />
              <span className="absolute right-[7px] size-1.5 rounded-full bg-[#58bea0]" />
              <span className="h-px w-4 rotate-[-18deg] bg-white/75" />
            </span>
            <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#26334f]">HowConnected</span>
          </Link>
          <span className="hidden rounded-full border border-[#dce0e6] bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-[#667086] sm:inline-flex">Follow the thread</span>
        </header>

        <section className="flex flex-1 flex-col items-center pt-20 text-center sm:pt-24 lg:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e3ded3] bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#687186] shadow-sm backdrop-blur">
            <span className="size-1.5 rounded-full bg-[#ff6846]" />
            Explore unexpected connections
          </div>
          <h1 className="mt-6 max-w-4xl text-balance text-[clamp(3rem,8vw,6.9rem)] font-extrabold leading-[0.9] tracking-[-0.072em] text-[#15213b]">
            Everything is{" "}
            <span className="relative whitespace-nowrap text-[#ff6846]">
              connected.
              <svg aria-hidden="true" className="absolute -bottom-2 left-1/2 h-3 w-[92%] -translate-x-1/2 text-[#f2b84a]" viewBox="0 0 320 18" fill="none" preserveAspectRatio="none">
                <path d="M3 13C76 2 223 3 317 10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-balance text-base leading-7 text-[#657087] sm:text-lg">
            Pick any two people, companies, places, teams, works, or ideas and discover how they connect.
          </p>

          <ConnectionExplorer />
        </section>

        <PublicFooter />
      </div>
    </main>
  );
}
