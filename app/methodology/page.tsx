import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/PublicPageShell";

const title = "How HowConnected verifies relationships | HowConnected";
const description =
  "Learn how HowConnected retrieves, ranks, reviews, and publishes relationship paths from Wikidata while preserving historical context.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/methodology" },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "HowConnected",
    url: "/methodology",
  },
  twitter: { card: "summary", title, description },
};

export default function MethodologyPage() {
  return (
    <PublicPageShell
      eyebrow="Editorial methodology"
      title="How we follow the evidence"
      intro="HowConnected combines live graph exploration with a smaller, carefully reviewed collection. Here is what that distinction means and how we keep published claims accountable."
    >
      <section>
        <h2>Where relationships come from</h2>
        <p>
          HowConnected uses structured statements from Wikidata. Each statement joins two
          entities through a named property—such as “founded by,” “creator,” or “crew
          member.” Links beside a result lead back to the relevant entities and property so
          you can inspect the source record yourself.
        </p>
      </section>

      <section>
        <h2>How live paths are found and ranked</h2>
        <p>
          A live search looks for short paths between the two entities a visitor chooses.
          Candidate paths are ranked for clarity and usefulness, favoring specific,
          understandable relationships over noisy graph shortcuts. Live results can change
          as Wikidata changes and are not automatically editorially verified or indexable.
        </p>
      </section>

      <section>
        <h2>Reviewed editorial connections</h2>
        <p>
          Pages marked “Reviewed connection” render from a committed snapshot rather than a
          live database query. Before approval, we check the exact Wikidata identifiers,
          properties, direction, wording, evidence, and material qualifiers. The page shows
          its last-reviewed date and links to both the structured statement and an
          authoritative contextual source.
        </p>
      </section>

      <section>
        <h2>Dates, roles, and historical qualifiers</h2>
        <p>
          Qualifiers can completely change a claim. Start and end dates distinguish a past
          team membership from a current one; a role can explain how someone participated;
          historical locations should not be presented as present-day locations. When a
          qualifier materially affects meaning, we preserve it in the snapshot and visible
          explanation.
        </p>
      </section>

      <section>
        <h2>Why some pages are withheld</h2>
        <p>
          A path may be plausible but still be ambiguous, stale, weakly sourced, or easy to
          misread. Those pairs remain noindex until review is complete. Arbitrary live-search
          URLs are also noindex: a successful graph search is not the same thing as editorial
          verification. Only approved canonical orientations appear in Explore or the
          sitemap.
        </p>
      </section>

      <section>
        <h2>Corrections and feedback</h2>
        <p>
          Knowledge graphs evolve, and we can make mistakes. If a relationship, date, role,
          direction, or source looks wrong, please <Link href="/contact">report the issue</Link>
          {" "}and include the connection URL. We can re-review, correct, or withhold the page
          without changing the live discovery engine.
        </p>
      </section>
    </PublicPageShell>
  );
}
