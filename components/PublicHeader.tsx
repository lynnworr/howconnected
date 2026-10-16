import Link from "next/link";
import AnalyticsLink from "@/components/AnalyticsLink";
import ThemeToggle from "@/components/ThemeToggle";

const NAVIGATION_LINKS = [
  { href: "/#search", label: "Search", destination: "search" },
  { href: "/explore", label: "Explore", destination: "explore" },
  {
    href: "/daily",
    label: "Daily",
    desktopLabel: "Daily challenge",
    destination: "daily",
  },
  {
    href: "/methodology",
    label: "Methodology",
    destination: "methodology",
    mobile: false,
  },
  { href: "/about", label: "About", destination: "about", mobile: false },
] as const;

export default function PublicHeader() {
  return (
    <header className="hc-public-header flex items-center justify-between gap-2 sm:gap-4">
      <Link
        href="/"
        className="inline-flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6846]"
        aria-label="Go to HowConnected home"
      >
        <span className="hc-logo relative grid size-8 place-items-center rounded-full">
          <span className="absolute left-[7px] size-1.5 rounded-full bg-[#ff795b]" />
          <span className="absolute right-[7px] size-1.5 rounded-full bg-[#58bea0]" />
          <span className="h-px w-4 rotate-[-18deg] bg-white/75" />
        </span>
        <span className="hc-brand hidden text-sm font-extrabold uppercase tracking-[0.18em] sm:inline">
          HowConnected
        </span>
      </Link>

      <nav aria-label="Primary navigation" className="hidden md:block">
        <ul className="flex items-center gap-1">
          {NAVIGATION_LINKS.map((link) => (
            <li key={link.destination}>
              <AnalyticsLink
                href={link.href}
                event="navigation_link_clicked"
                eventProperties={{
                  destination: link.destination,
                  navigationPlacement: "desktop_header",
                }}
                className="hc-nav-link rounded-full px-3 py-2 text-sm font-bold text-[#59647a] transition hover:text-[#b44730] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] lg:px-4"
              >
                {"desktopLabel" in link ? link.desktopLabel : link.label}
              </AnalyticsLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <nav aria-label="Mobile navigation" className="min-w-0 md:hidden">
          <ul className="flex items-center gap-0.5">
            {NAVIGATION_LINKS.filter(
              (link) => !("mobile" in link) || link.mobile !== false,
            ).map((link) => (
              <li key={link.destination}>
                <AnalyticsLink
                  href={link.href}
                  event="navigation_link_clicked"
                  eventProperties={{
                    destination: link.destination,
                    navigationPlacement: "mobile_header",
                  }}
                  className="hc-mobile-nav-link inline-flex min-h-10 items-center rounded-full px-2 text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ff6846] min-[375px]:px-2.5 min-[430px]:text-xs"
                >
                  {link.label}
                </AnalyticsLink>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
