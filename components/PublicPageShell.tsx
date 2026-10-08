import Link from "next/link";
import type { ReactNode } from "react";
import PublicFooter from "@/components/PublicFooter";

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
    <main className="relative min-h-screen overflow-hidden bg-[#f7f5ef] text-[#15213b]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(255,190,130,0.24),transparent_26%),radial-gradient(circle_at_90%_20%,rgba(102,190,163,0.16),transparent_24%),linear-gradient(180deg,#fbfaf6_0%,#f5f3ed_100%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-12 pt-5 sm:px-7 lg:px-10">
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]"
            aria-label="HowConnected home"
          >
            <span className="relative grid size-8 place-items-center rounded-full bg-[#17233f]">
              <span className="absolute left-[7px] size-1.5 rounded-full bg-[#ff795b]" />
              <span className="absolute right-[7px] size-1.5 rounded-full bg-[#58bea0]" />
              <span className="h-px w-4 rotate-[-18deg] bg-white/75" />
            </span>
            <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#26334f]">
              HowConnected
            </span>
          </Link>
        </header>

        <article className="my-12 flex-1 rounded-[28px] border border-[#e2e5ea] bg-white/85 px-6 py-9 shadow-[0_24px_80px_rgba(20,30,50,0.08)] sm:px-10 sm:py-12">
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
