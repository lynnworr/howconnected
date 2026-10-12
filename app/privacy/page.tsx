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
      eyebrow="Last updated October 10, 2026"
      title="Privacy Policy"
      intro="This policy explains the limited data HowConnected uses to understand and improve the service."
    >
      <section>
        <h2>Analytics and path feedback</h2>
        <p>
          HowConnected uses basic analytics to understand page visits and
          broad product usage, including whether searches succeed, time out,
          are shared, lead to another search, or begin from Explore, Surprise
          Me, or the browser extension. Extension attribution uses only a
          fixed source label; it does not include the Wikipedia page URL or a
          persistent user identifier. Analytics events do not include search
          text, full browsing URLs, contact-form contents, or email addresses. The
          site also accepts path-quality feedback,
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
        <h2>Daily challenge progress</h2>
        <p>
          The experimental daily challenge stores completed UTC dates and an
          optional streak only in your browser. This local progress is not an
          account, does not synchronize across devices, and is not sent to
          HowConnected. Bounded challenge analytics may record the reviewed
          puzzle identifier, category, UTC date, whether an answer was correct,
          a fixed reading or evidence link type, and a successful share method,
          but not the selected answer, full link URL, or a personal identifier.
        </p>
      </section>
      <section>
        <h2>Contact messages</h2>
        <p>
          When you use the contact form, HowConnected sends the name, email
          address, subject, and message you provide to the site owner through
          an email delivery provider. Contact messages are not stored in the
          connection graph. This information is used to review and respond to
          your request and to prevent abuse of the form.
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
