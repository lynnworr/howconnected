import type { Metadata } from "next";
import PublicPageShell from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "Terms | HowConnected",
  description: "Simple terms for using the HowConnected service.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Last updated October 8, 2026"
      title="Terms"
      intro="HowConnected is an informational and entertainment service for exploring relationships in public structured data."
    >
      <section>
        <h2>Using the service</h2>
        <p>
          Connection paths are provided for general information and curiosity.
          HowConnected does not guarantee that every path is complete,
          current, or error-free, and a displayed connection does not imply a
          personal relationship or endorsement.
        </p>
      </section>
      <section>
        <h2>Third-party information</h2>
        <p>
          Data may come from third-party public sources. Verify important
          information with the original sources before relying on it. External
          links are provided for convenience, and HowConnected is not
          responsible for their content or availability.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          The site, its features, and these terms may change over time. The
          service may also be interrupted or become unavailable. HowConnected
          is not a source of legal, medical, financial, or other professional
          advice.
        </p>
      </section>
    </PublicPageShell>
  );
}
