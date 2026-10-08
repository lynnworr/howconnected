import type { Metadata } from "next";
import PublicPageShell from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | HowConnected",
  description:
    "HowConnected's privacy policy for analytics, path feedback, cookies, and possible future advertising.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Last updated October 8, 2026"
      title="Privacy Policy"
      intro="This policy explains the limited data HowConnected uses to understand and improve the service."
    >
      <section>
        <h2>Analytics and path feedback</h2>
        <p>
          HowConnected uses basic analytics to understand page visits and
          broad product usage. The site also accepts path-quality feedback,
          such as whether a result was useful and a selected reason. This
          feedback helps improve connection quality.
        </p>
        <p>
          Admin and internal diagnostic data is designed not to intentionally
          collect personally identifiable information. Please do not submit
          personal information through feedback controls.
        </p>
      </section>
      <section>
        <h2>Cookies and similar technologies</h2>
        <p>
          Analytics providers and other site services may use cookies or
          similar technologies where applicable. Browser settings can be used
          to control or remove cookies, though doing so may affect some site
          features.
        </p>
      </section>
      <section>
        <h2>Possible future advertising</h2>
        <p>
          HowConnected does not currently display Google AdSense ads. The site
          may add advertising in the future. If it does, third-party vendors
          such as Google may use cookies or other identifiers to serve,
          personalize, and measure ads.
        </p>
        <p>
          You can manage or opt out of personalized ads through
          Google&apos;s{" "}
          <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">
            Ads Settings
          </a>
          .
        </p>
      </section>
      <section>
        <h2>Personal information and updates</h2>
        <p>
          HowConnected does not sell personal information. This policy may be
          updated as the site, its providers, and its features evolve. The
          latest version will be posted on this page with an updated date.
        </p>
      </section>
    </PublicPageShell>
  );
}
