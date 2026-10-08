import Link from "next/link";

export const PUBLIC_FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;

export default function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-[#dfe2e5]/70 pt-6 text-xs text-[#818999]">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p>Curiosity has no dead ends.</p>
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {PUBLIC_FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-sm underline decoration-transparent underline-offset-4 transition hover:text-[#46516a] hover:decoration-[#aeb5c1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
