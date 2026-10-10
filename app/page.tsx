import type { Metadata } from "next";
import ConnectionExplorer from "@/components/ConnectionExplorer";
import PublicFooter from "@/components/PublicFooter";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicHeader from "@/components/PublicHeader";
import SurpriseMe from "@/components/SurpriseMe";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default function Home() {
  return (
    <main className="hc-public relative min-h-screen overflow-hidden">
      <NetworkBackdrop />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-5 sm:px-7 lg:px-10">
        <PublicHeader />

        <section className="hc-hero flex flex-1 flex-col items-center pt-20 text-center sm:pt-24 lg:pt-28">
          <div className="hc-eyebrow inline-flex items-center gap-2 rounded-full border border-[#e3ded3] bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#687186] shadow-sm backdrop-blur">
            <span className="size-1.5 rounded-full bg-[#ff6846]" />
            Explore unexpected connections
          </div>
          <h1 className="hc-hero-title mt-6 max-w-4xl text-balance text-[clamp(3rem,8vw,6.9rem)] font-extrabold leading-[0.9] tracking-[-0.072em] text-[#15213b]">
            Everything is{" "}
            <span className="hc-coral relative whitespace-nowrap text-[#ff6846]">
              connected.
              <svg aria-hidden="true" className="absolute -bottom-2 left-1/2 h-3 w-[92%] -translate-x-1/2 text-[#f2b84a]" viewBox="0 0 320 18" fill="none" preserveAspectRatio="none">
                <path d="M3 13C76 2 223 3 317 10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="hc-hero-copy mt-8 max-w-2xl text-balance text-base leading-7 text-[#657087] sm:text-lg">
            Pick any two people, companies, places, teams, works, or ideas and discover how they connect.
          </p>

          <ConnectionExplorer />
          <SurpriseMe />
        </section>

        <PublicFooter />
      </div>
    </main>
  );
}
