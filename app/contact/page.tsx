import type { Metadata } from "next";
import PublicPageShell from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "Contact | HowConnected",
  description: "Contact HowConnected about the site or a connection path.",
  alternates: { canonical: "/contact" },
};

function configuredContactEmail(): string | null {
  const value = process.env.CONTACT_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export default function ContactPage() {
  const contactEmail = configuredContactEmail();

  return (
    <PublicPageShell
      eyebrow="Get in touch"
      title="Contact"
      intro="Questions, corrections, and thoughtful notes about HowConnected are welcome."
    >
      <section>
        <h2>Email</h2>
        {contactEmail ? (
          <p>
            Send a note to{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        ) : (
          <p>
            The public contact address is not configured yet. Site owner:
            set the <code>CONTACT_EMAIL</code> configuration value to publish a
            contact link here before launch.
          </p>
        )}
      </section>
      <section>
        <h2>Reporting a path issue</h2>
        <p>
          For a specific connection, the quickest option is the path-quality
          feedback control on that result page. It sends structured feedback
          without asking for personal details.
        </p>
      </section>
    </PublicPageShell>
  );
}
