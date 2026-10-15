# Phase 7D — AdSense and monetization readiness

Reviewed: October 14, 2026

## Decision

HowConnected is **technically well prepared but not ready to activate advertising**. Its strongest approval signals are original reviewed explanations, visible evidence and review dates, a substantial methodology page, clear navigation, legal/contact pages, stable canonicals, and safeguards that keep arbitrary live-search results out of the index. The site has ten approved editorial connection pages plus the separate 100-puzzle Daily library.

Approval is never guaranteed. The reviewed editorial collection is still modest, and Google reviews the entire site. The owner should establish stable indexing and real usage of the original educational pages before applying, then complete ownership verification and consent setup in AdSense.

## Confirmed current state

- The owner-provided AdSense account identifier is present only in the global site-verification meta tag. No ad tag, advertising SDK, or `ads.txt` entry is present.
- No Google-certified consent management platform is integrated.
- The Privacy Policy truthfully says AdSense is not currently displayed and now explains the categories of technology that would require disclosure before activation.
- Vercel Web Analytics is the only product analytics integration. The Phase 7A event allowlist and Phase 7C referral behavior are unchanged.
- Homepage, Explore, Daily, Methodology, About, Privacy, Terms, Contact, and extension information are linked through the public header or footer. The Contact form and policy pages are complete and reachable in the built application.
- Approved editorial pages add original explanation, context, relationship direction, qualifiers, sources, and review dates. Unapproved or reverse connection pages remain noindex and excluded from the sitemap.
- The existing future-ad placeholder was inert. It is now explicitly gated by production environment, affirmative consent, an enabled flag, and a correctly shaped owner-supplied publisher ID. No caller supplies an activation object, so every slot still renders nothing.
- Potential placements are restricted to reviewed editorial results, between substantial Explore sections, and after long-form Methodology content. Daily gameplay, live unreviewed results, forms, legal pages, navigation, evidence links, and the extension remain ad-free.

## Confirmed blockers before activation

1. The domain has not been shown locally as `Ready` in the owner’s AdSense Sites dashboard; the owner must ask AdSense to verify the deployed meta tag and review the site.
2. No certified CMP or regional consent behavior has been configured or tested.
3. The Privacy Policy is a readiness disclosure, not the final live-vendor disclosure. It must be reviewed against the actual Google/CMP configuration immediately before ad code is enabled.
4. `ads.txt` is intentionally absent. Add it only from the exact snippet supplied by the owner’s AdSense account.
5. Core Web Vitals, mobile placement behavior, consent flows, and ad-label separation have not been tested with real ad creative.

## Recommendations, not confirmed policy failures

- Grow the reviewed editorial collection beyond ten pages and confirm that Search Console is indexing those pages. A small library is an approval risk, but Google publishes no guaranteed minimum page or traffic count.
- Expand About with more project/editorial background if the owner can add meaningful, original detail. Do not pad it for length.
- Defer homepage advertising until traffic data shows a placement can sit below the core search and educational discovery content without distracting from it.
- Keep The Missing Link ad-free initially. Its answer-selection surface has a high accidental-click risk and is central to repeat use.

## Official requirements reviewed

- Google verifies site ownership using an ad code snippet, an `ads.txt` entry, or a meta tag, then reviews the site before it can reach `Ready`: https://support.google.com/adsense/answer/12131223
- Connecting a site requires a live, crawlable site and an owner-selected verification method; approval can take days and sometimes longer: https://support.google.com/adsense/answer/7584263
- Google Publisher Policies disallow ads on low-value, navigation-only, under-construction, replicated, or ad-heavy screens and require clear privacy disclosures: https://support.google.com/adsense/answer/10502938
- Ads must not be mistaken for navigation or be positioned to cause accidental clicks; labels must be “Advertisements” or “Sponsored links”: https://support.google.com/adsense/answer/1282097
- Serving personalized ads in the EEA, UK, or Switzerland requires a Google-certified CMP integrated with the IAB TCF. The owner remains responsible for legal compliance: https://support.google.com/adsense/answer/13554116
- The Privacy Policy must disclose Google/third-party cookie and advertising-data use and provide applicable choice information: https://support.google.com/adsense/answer/1348695
- `ads.txt` is highly recommended and must contain the real account publisher ID at the root domain: https://support.google.com/adsense/answer/12171612

## Placement plan

| Surface | Proposed location | Decision | Guardrail |
| --- | --- | --- | --- |
| Approved editorial connection | After the complete reviewed explanation, before secondary interaction controls | Prepared, inactive | Render only when `editorial` exists; never on live/unreviewed results |
| Explore | Between the featured connection and the substantial reviewed collection | Prepared, inactive | One clearly labeled responsive unit; content must remain dominant |
| Methodology or future long-form education | After the complete article | Prepared, inactive | Keep sources and contextual links unobstructed |
| Homepage | Below the educational discovery section | Deferred | Reassess after layout and traffic review; never interrupt search controls |
| The Missing Link | None | Excluded initially | No ads in the prompt, options, reveal, evidence, or sharing flow |

All prepared containers reserve 250 pixels of height only after every activation gate passes. In their current configuration they return `null`, so they add no layout, network request, script, cookie, or accessibility surface.

## Illustrative revenue scenarios

These are hypothetical planning examples, not HowConnected performance forecasts or AdSense quotes. “Page RPM” is assumed revenue per 1,000 total page views and already reflects the illustrative mix of monetized and unmonetized views.

| Monthly page views | Illustrative monetized views | Hypothetical page RPM | Illustrative monthly revenue |
| ---: | ---: | ---: | ---: |
| 10,000 | 6,000 (60%) | $2.00 | $20 |
| 50,000 | 35,000 (70%) | $3.00 | $150 |
| 250,000 | 187,500 (75%) | $5.00 | $1,250 |
| 1,000,000 | 800,000 (80%) | $7.00 | $7,000 |

At these assumptions, advertising becomes material only at sustained traffic in the hundreds of thousands of monthly page views. Actual RPM, fill, geography, seasonality, consent choices, viewability, content mix, invalid-traffic filtering, and advertiser demand can move results substantially in either direction.

## Owner application checklist

1. Confirm that the owner is eligible for AdSense and controls `howconnected.app` and its HTML/deployment.
2. Review Search Console indexing, manual actions, Core Web Vitals, mobile usability, sitemap processing, and the ten editorial canonical pages.
3. In the owner’s AdSense account, add `howconnected.app` under **Sites** and select meta-tag ownership verification. The exact owner-provided account identifier is already implemented globally; deploy it before requesting verification.
4. Confirm that AdSense detects the deployed meta tag. Do not add the JavaScript snippet merely for ownership verification.
5. Select Google Privacy & Messaging or another currently Google-certified CMP. Configure EEA, UK, and Swiss consent, decide personalized/non-personalized/limited-ad behavior, review US-state requirements, and obtain legal advice where appropriate.
6. Update the Privacy Policy to name the actual providers and choices. Confirm Terms and contact details remain accurate.
7. Add the exact account-provided `ads.txt` line at `https://www.howconnected.app/ads.txt`; verify HTTP 200, plain-text content, exact publisher ID, and AdSense’s Authorized status.
8. Request site review in AdSense. Monitor **Sites**, **Policy center**, and **Privacy & messaging**; correct the stated issue rather than retrying blindly.
9. After the site is `Ready`, wire the owner-supplied configuration and CMP consent state into the prepared slots in a reviewed change. Load Google’s script only on production pages eligible for ads.
10. Test mobile/desktop layouts, keyboard and screen-reader reading order, consent denial and withdrawal, ad blocking, no-fill behavior, CLS, LCP, INP, canonical metadata, and accidental-click spacing.
11. Activate a single editorial placement first, monitor policy messages and Core Web Vitals, then consider Explore. Homepage remains a later experiment; Daily remains excluded unless separately authorized after UX review.

No application, account creation, ownership verification, CMP selection, `ads.txt` publication, script loading, ad request, commit, push, or deployment was performed in Phase 7D.
