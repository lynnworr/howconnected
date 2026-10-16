import type { Metadata } from "next";
import Link from "next/link";
import PublisherRequestForm from "@/components/PublisherRequestForm";
import PublicPageShell from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "Request a custom relationship widget | HowConnected",
  description: "Request editorial review for a custom, evidence-linked HowConnected relationship widget.",
  alternates: { canonical: "/widgets/request" },
};

export default function WidgetRequestPage() {
  return (
    <PublicPageShell
      eyebrow="Publisher pilot"
      title="Request a custom connection."
      intro="Tell us what relationship would help your readers. Every request is evaluated manually for meaning, accuracy, evidence quality, and fit with the pilot."
    >
      <section aria-labelledby="request-expectations">
        <h2 id="request-expectations">Before you submit</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Editorial, not automatic", "Requests never publish directly and arbitrary graph paths are not accepted."],
            ["Evidence required", "Approved widgets need reliable sources, correct relationship direction, and historical context."],
            ["Pilot availability", "Submission does not guarantee approval, delivery timing, custom work, or a commercial agreement."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-[#dfe2e5] bg-white/55 p-4">
              <h3 className="font-bold text-[#1d2944]">{title}</h3>
              <p className="mt-2 text-sm leading-6">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="request-form-heading">
        <h2 id="request-form-heading">Publisher request</h2>
        <p className="mt-2 max-w-2xl">
          Collecting only what is needed to evaluate the relationship and publishing context. Please do not include confidential, sensitive, or payment information.
        </p>
        <div className="hc-form-surface relative mt-6 rounded-3xl border p-5 sm:p-7">
          <PublisherRequestForm />
        </div>
      </section>

      <section aria-labelledby="request-privacy">
        <h2 id="request-privacy">Privacy and follow-up</h2>
        <p>
          Request details are delivered privately by email to the site owner, are not added to the public graph, and are not included in product analytics. If the request looks suitable, the owner may reply to clarify editorial scope or share a reviewed embed snippet.
        </p>
        <p>
          For general questions instead, use the <Link href="/contact">contact form</Link>. See the <Link href="/privacy">privacy policy</Link> for how submitted information is handled.
        </p>
      </section>
    </PublicPageShell>
  );
}
