# Phase 6A growth, retention, and monetization foundation

Reviewed: October 11, 2026

## Product analytics

HowConnected uses Vercel Web Analytics for page views and bounded product events. Event properties use Wikidata QIDs, reviewed editorial slugs, fixed action names, counts, and bounded technical failure categories. They must not contain typed search text, email addresses, contact messages, IP addresses, full referring URLs, or persistent user identifiers.

The implemented event inventory is:

| Funnel area | Event | Useful properties |
| --- | --- | --- |
| Entity selection | `entity_lookup_completed` | result count and selection state |
| Search start | `search_initiated` | endpoint QIDs and ephemeral session sequence |
| Repeat search | `additional_search_started` | endpoint QIDs and sequence greater than one |
| Meaningful result | `search_succeeded` | endpoint QIDs, step count, alternates, origin |
| No reliable result | `search_no_reliable_path` | endpoint QIDs, origin, bounded failure category |
| Timeout | `search_timed_out` | endpoint QIDs, origin, bounded failure category |
| Technical failure | `search_failed` | endpoint QIDs and origin |
| Explore | `explore_connection_opened`, `explore_category_selected` | reviewed slug, placement, or category |
| Related paths | `related_connection_opened` | source and destination reviewed slugs |
| Surprise Me | `surprise_me_used`, `surprise_me_shuffled` | fixed pair IDs |
| Sharing | `result_shared` | endpoint QIDs, steps, successful share method |
| Result continuation | `try_another_clicked`, `result_next_action_clicked` | fixed origin or destination |
| Extension referral | `extension_referral_opened` | endpoint QIDs only |

Inspect these in the Vercel project under **Analytics → Events**. Build a search-outcome funnel from `search_initiated` to exactly one of the four outcome events. Use `additional_search_started` and `result_next_action_clicked` for repeat-use signals. Compare `origin: extension` and `extension_referral_opened` only after a future extension version begins sending the attribution parameter.

## Extension attribution plan

The submitted extension 1.0.0 and its release archive are unchanged. A future release can append the fixed query parameter `source=extension` when it opens a connection, for example `/connect/Q937/Q935?source=extension`. The website allowlists only the exact value `extension`, records one referral event with the two already-visible QIDs, and keeps the canonical URL free of the parameter.

This design does not send the Wikipedia URL, create a user ID, use a cookie, retain a referrer, or join activity across sites. Before a future extension release, update its public disclosures to say that the destination page receives the fixed source label, then add tests for URL generation and packaging. Do not modify the already-submitted 1.0.0 package in place.

## Engagement changes

Result pages now offer three clear next actions: start another search, browse reviewed paths, or use Surprise Me. Explore cards, category jumps, related editorial links, and Surprise Me shuffles have bounded engagement events. These changes reuse semantic links, preserve server-rendered editorial content, and add no account, payment, streak, or gamification state.

## AdSense readiness audit

Current strengths:

- The production custom domain is reachable over HTTPS, and the required public pages return HTTP 200.
- Navigation exposes Explore, Methodology, About, Privacy, Terms, Contact, and extension information.
- Ten approved editorial connection pages provide original explanations, evidence, review dates, related links, and stable canonicals.
- Arbitrary or review-gated connection pages retain indexing safeguards, limiting thin search-result inventory.
- The responsive theme and mobile layouts are already established.
- The privacy page states that AdSense is not currently installed and describes future advertising at a high level.

Readiness assessment: **not yet application-ready, but close enough for a focused pre-application pass**. Search Console is still establishing indexing evidence, and the site should demonstrate that its reviewed content—not live search-result inventory—is the primary public value. Before applying:

1. Wait for Search Console to show stable discovery/indexing of Explore, Methodology, and the approved editorial collection, then resolve any coverage or mobile usability issues.
2. Have the owner review the public legal pages and expand the privacy disclosure to the final ad-vendor and cookie language immediately before ad code is added.
3. Select and configure a Google-certified CMP before requesting ads for visitors in the EEA, UK, or Switzerland. Validate consent-mode behavior by region.
4. Decide whether to serve personalized, non-personalized, or limited ads and document the applicable US-state privacy controls. Obtain legal advice where needed.
5. Add `ads.txt` only after an AdSense account supplies the real publisher identifier; never add a placeholder publisher ID.
6. Recheck Core Web Vitals and mobile layout with representative ad sizes before enabling ads.
7. Complete AdSense's site-ownership verification in the publisher dashboard; public reachability alone does not prove account-level ownership.

Suitable future placements are below the complete evidence/review content on an approved editorial page and, at most, between substantial sections of a long Explore collection. Avoid ads in the search form, loading state, path visualization, no-result/error states, Contact form, legal/privacy pages, extension information, or adjacent to evidence/share controls. Keep the existing null ad placeholder inactive until consent and approval work is complete.

Google's current guidance emphasizes unique content, straightforward navigation, privacy disclosures, and a certified CMP for applicable European traffic:

- https://support.google.com/adsense/answer/7299563
- https://support.google.com/adsense/answer/10502938
- https://support.google.com/adsense/answer/13554116
- https://support.google.com/adsense/answer/9785052

## Monetization opportunity ranking

Scores are relative, from 1 (low) to 5 (high). Effort and operating cost use 5 to mean expensive.

| Rank | Opportunity | User value | Effort | Acquisition | Recurring revenue | Operating cost | Recommendation |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Daily connection challenge | 4 | 3 | 5 | 2 | 2 | Validate retention with a small, reviewed daily format before adding game systems. |
| 2 | Free extension distribution | 4 | 2 | 5 | 1 | 2 | Treat as an acquisition channel; measure attributed visits after a future release. |
| 3 | Educational experiences | 5 | 4 | 4 | 4 | Test classroom lessons or institution licensing with educators before building accounts. |
| 4 | Carefully placed site ads | 2 | 3 | 1 | 3 | 2 | Pursue only after indexing, consent, policy, and layout readiness; protect the core result experience. |
| 5 | Publisher widgets | 4 | 4 | 4 | 4 | 3 | Prototype an evidence-linked embed with a small publishing partner; require attribution and caching. |
| 6 | Premium subscription | 3 | 5 | 2 | 5 | 4 | Do not launch an ad-free tier alone. First validate demand for saved research collections, exports, or collaborative teaching tools. |
| 7 | API/business access | 3 | 5 | 3 | 5 | 5 | Defer until reliability, abuse controls, licensing, quotas, billing, and an SLA can be supported. |

The near-term sequence is measurement, retention experiments, and extension distribution. Revenue experiments should follow demonstrated repeat use; willingness to pay is currently unproven.
