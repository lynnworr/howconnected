import type { Metadata } from "next";
import PublicPageShell from "@/components/PublicPageShell";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact | HowConnected",
  description: "Contact HowConnected about the site or a connection path.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Get in touch"
      title="Contact"
      intro="Report an incorrect connection, suggest an improvement, share feedback, or get in touch about HowConnected."
    >
      <section>
        <h2>Send a message</h2>
        <p className="mt-2 max-w-2xl">
          Use this form for general feedback, bug reports, feature ideas, or
          business inquiries. If a connection looks wrong, include the two
          entities and, when possible, the result-page URL.
        </p>
        <div className="relative mt-6 rounded-3xl border border-[#e1e5eb] bg-[#fbfbf8] p-5 sm:p-7">
          <ContactForm />
        </div>
      </section>
      <section>
        <h2>Reporting a path issue</h2>
        <p>
          The path-quality feedback control on each result remains the quickest
          way to flag a specific connection anonymously. Use this form when you
          would like a reply or need to provide more context.
        </p>
      </section>
    </PublicPageShell>
  );
}
