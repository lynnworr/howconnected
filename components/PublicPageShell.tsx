import type { ReactNode } from "react";
import PublicFooter from "@/components/PublicFooter";
import NetworkBackdrop from "@/components/NetworkBackdrop";
import PublicHeader from "@/components/PublicHeader";

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export default function PublicPageShell({
  eyebrow,
  title,
  intro,
  children,
}: PublicPageShellProps) {
  return (
    <main className="hc-public relative min-h-screen overflow-hidden">
      <NetworkBackdrop />
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-12 pt-5 sm:px-7 lg:px-10">
        <PublicHeader />

        <article className="hc-panel hc-content-panel my-12 flex-1 rounded-[28px] border px-6 py-9 sm:px-10 sm:py-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ee6243]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.045em] text-[#15213b] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#657087]">
            {intro}
          </p>
          <div className="mt-9 space-y-8 text-[15px] leading-7 text-[#46516a] [&_a]:font-semibold [&_a]:text-[#b44730] [&_a]:underline [&_a]:decoration-[#e4b2a7] [&_a]:underline-offset-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1d2944] [&_p+p]:mt-3">
            {children}
          </div>
        </article>

        <PublicFooter />
      </div>
    </main>
  );
}
