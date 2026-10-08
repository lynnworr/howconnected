import type { Metadata } from "next";
import PublicPageShell from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "About | HowConnected",
  description:
    "Learn how HowConnected finds real-world relationship paths using structured knowledge sources.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About the project"
      title="Making connections visible"
      intro="HowConnected turns structured knowledge into short, explorable paths between things that may seem far apart."
    >
      <section>
        <h2>What HowConnected does</h2>
        <p>
          Choose two people, companies, places, works, teams, or ideas and
          HowConnected looks for a meaningful relationship path between them.
          The result shows each entity and the relationship that leads to the
          next one.
        </p>
      </section>
      <section>
        <h2>Where the connections come from</h2>
        <p>
          Paths are built from structured knowledge sources such as Wikidata.
          Source links are included with the result so you can inspect the
          underlying Wikipedia or Wikidata pages and keep exploring.
        </p>
      </section>
      <section>
        <h2>An independent project</h2>
        <p>
          HowConnected is an independent service. It is not affiliated with,
          endorsed by, or operated by Wikipedia, the Wikimedia Foundation, or
          Wikidata.
        </p>
      </section>
    </PublicPageShell>
  );
}
