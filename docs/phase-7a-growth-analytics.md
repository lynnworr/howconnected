# Phase 7A - Growth analytics and product performance

Prepared: October 14, 2026

## Measurement principles

HowConnected uses Vercel Web Analytics for aggregate traffic and the existing `track()` integration for bounded product events. No additional analytics vendor, cookie, account, persistent cross-site identifier, or user profile is introduced.

Vercel's visitor metric is privacy-preserving but is not an exact count of people. Vercel documents that its visitor hash resets daily and cannot follow a visitor across different days or sites. Treat it as a daily visitor estimate. Page views and custom-event counts are occurrences, not unique people.

Official references:

- Vercel Web Analytics: https://vercel.com/docs/analytics
- Vercel custom events: https://vercel.com/docs/analytics/custom-events
- Vercel dashboard filtering and CSV export: https://vercel.com/docs/analytics/using-web-analytics
- Google Search Console performance reporting: https://support.google.com/webmasters/answer/7576553
- Google Search Console report exports: https://support.google.com/webmasters/answer/12919797

## Existing analytics inventory

### Traffic

`<Analytics />` is mounted once in the root layout. Vercel supplies page views, daily-reset visitor estimates, top pages, routes, referrers, devices, browsers, countries, and supported filters. Query parameters are not treated as content URLs in the Pages panel.

### Search and connection events

| Event | Firing condition | Bounded properties |
| --- | --- | --- |
| `entity_lookup_completed` | A current autocomplete request returns | Query length and result count, never query text |
| `search_initiated` | A valid two-entity homepage request starts | Two QIDs, `homepage`, session sequence |
| `search_succeeded` | A meaningful result renders | Two QIDs, steps, alternate count, bounded origin |
| `search_no_reliable_path` | Discovery ends without an acceptable path | Two QIDs, origin, optional session sequence and failure category |
| `search_timed_out` | Discovery reports or reaches its timeout | Same bounded outcome properties |
| `search_failed` | A technical request/result failure occurs | Same bounded outcome properties |
| `additional_search_started` | A later search starts after a result was viewed in the browser session | Two QIDs and session sequence |
| `alternate_paths_opened` | A user opens the alternate-path disclosure | Two QIDs and alternate count |
| `result_shared` | Native sharing or clipboard copy succeeds | Two QIDs, steps, share method, origin |
| `entity_source_opened` | A Wikipedia or Wikidata source is opened | Entity QID, destination type, fixed UI context |
| `try_another_clicked` | The explicit reset/navigation action is selected | Bounded origin and optional endpoint QIDs |
| `result_next_action_clicked` | Explore or Surprise Me is selected from a result | Fixed destination and endpoint QIDs |

Direct connection URLs can produce an outcome event without a corresponding homepage `search_initiated` event. Search success rate must therefore use events segmented to `origin=homepage`, not an unfiltered outcome numerator divided by all initiations.

### The Missing Link

| Event | Meaning |
| --- | --- |
| `daily_challenge_opened` | Production challenge rendered once per puzzle/session |
| `daily_challenge_answer_submitted` | First scored submission |
| `daily_challenge_completed` | First local completion |
| `daily_challenge_result_shared` | Successful native share or clipboard copy |
| `daily_wikipedia_link_clicked` | A reviewed reading link was selected |
| `daily_evidence_link_clicked` | A reviewed evidence link was selected |
| `daily_continued_exploration` | Explore was selected after reveal |

Properties are limited to puzzle ID, editorial category, UTC date where applicable, correctness, fixed link/share type, and the exact allowlisted extension origin. Selected answer IDs and answer text are excluded. Preview traffic is now intentionally excluded from all production daily events.

Device-local completion and streak data remain in local storage. They are not uploaded and must not be described as sitewide retention data.

### Extension, discovery, and feedback

- `extension_referral_opened` distinguishes `destination=connection` and `destination=daily`.
- Connection and daily downstream events retain only `origin=extension`, allowing success, completion, and share counts to be segmented without retaining a Wikipedia URL or title.
- `explore_connection_opened`, `explore_category_selected`, and `related_connection_opened` measure reviewed-content interactions using editorial slugs, placement, or category.
- `surprise_me_used` and `surprise_me_shuffled` use curated pair IDs and QIDs.
- `path_feedback_submitted` is emitted server-side only after validated feedback storage succeeds. It contains QIDs, bounded rating/reason, and path length.

## Reliability changes

All client product events now pass through a central runtime allowlist. An event is dropped if it has an unknown property, invalid QID, unapproved enum, malformed UTC date, unbounded identifier, or missing required property. This prevents an accidental future call from sending raw search text, answer text, email, page title, full URL, or an arbitrary source value.

The following behaviors are explicit:

- canceled or failed shares do not count;
- repeated daily submissions and completions do not count;
- each production daily open is claimed once per puzzle/browser session;
- daily extension referrals have a separate once-per-puzzle/session claim;
- preview gameplay produces no production product events;
- daily properties use the scheduled UTC date key;
- client effect guards prevent React re-renders from duplicating result/referral events within a mount;
- a browser reload or later visit can create another event occurrence and is not claimed to be a unique person;
- back/forward and repeated navigation are event occurrences unless the feature-specific daily claim suppresses them.

## Metric definitions

| Area | Metric | Definition |
| --- | --- | --- |
| Traffic | Daily visitors | Vercel visitor estimate for one UTC/reporting day; not unique people across days |
| Traffic | Page views | Vercel page-view count |
| Traffic | Top landing pages/referrers | Vercel Pages, Routes, and Referrers panels |
| Traffic | Search-engine traffic | Referrer-filtered Vercel visits plus Search Console organic clicks |
| Search | Initiated | `search_initiated`, normally filtered to `origin=homepage` |
| Search | Success rate | Homepage `search_succeeded` / all homepage search outcome events |
| Search | Outcome coverage | Homepage outcome events / homepage `search_initiated`; use as a reliability diagnostic |
| Daily | Submission rate | Submissions / opens |
| Daily | Completion rate | Completions / opens |
| Daily | Correct-answer rate | Correct submissions / submissions |
| Daily | Share rate | Successful shares / completions |
| Daily | Reading/evidence engagement | Corresponding click events / completions, reported separately |
| Extension | Referral mix | Connection and daily referral events by destination |
| Extension | Connection engagement | `search_succeeded` and `result_shared` with `origin=extension` |
| Extension | Daily engagement | Daily completion/share events with `origin=extension` |
| Discovery | Reviewed-content engagement | Explore, category, related-link, and daily-continuation events |
| Retention | Repeat daily engagement | Aggregate daily opens/completions on multiple dates; not a person-level cohort |
| Retention | Repeat search signal | `additional_search_started`; browser-session signal only |

Rates should be suppressed as `n/a` when their denominator is zero. Never add daily visitor estimates across dates and label the sum unique people.

## Owner reporting workflow

### Weekly Vercel review

1. Open the production Vercel project, then **Analytics**.
2. Select **Production** and a fixed seven-day period. Record visitors and page views.
3. Export the Pages/Routes and Referrers panels through their three-dot **Export as CSV** action. Vercel documents a maximum of 250 panel rows per export.
4. Record `/daily`, `/explore`, `/extension`, `/`, and reviewed `/connect/...` traffic separately.
5. Open the Events panel. Record total counts for the events in this document.
6. For rates and attribution, drill into the documented properties: `origin`, `isCorrect`, `destination`, `category`, `method`, and `placement`.
7. Compare to the immediately preceding period using the same duration and environment. Label incomplete current days.

Custom events currently require a Vercel Pro or Enterprise plan. Page-view analytics is available on all plans. Before deployment, confirm Web Analytics is enabled and the production project plan supports custom events; otherwise traffic metrics will work but product funnels will not populate.

### Normalized event report

The repository includes `npm run growth:report -- <file.csv>`. Normalize the selected dashboard counts into this exact header:

```csv
date,event,segment_key,segment_value,count
```

Use one unsegmented row for each event total, leaving both segment columns blank. Add separate rows for dashboard property breakdowns. For example, an extension referral breakdown uses `segment_key=destination` and either `connection` or `daily`. Do not add raw queries, URLs, titles, email, IP data, or user identifiers. The script rejects unknown events and unsupported segment keys.

The report calculates search, daily, extension, and discovery totals and rates. It does not invent visitors, page views, or production values. Keep the original Vercel exports alongside the normalized input for auditability.

### Google Search Console

Use Search Console as the source for search impressions, organic clicks, average CTR, average position, queries, landing pages, and sitemap/indexing health:

1. Open **Performance > Search results** for the production property.
2. Use the same date period as the Vercel review and keep Search type consistent.
3. Export the chart plus the Queries and Pages views to CSV, Excel, or Google Sheets.
4. Record clicks, impressions, CTR, and position. Review high-impression/low-CTR pages separately.
5. Open **Indexing > Pages** and **Sitemaps**. Confirm the production sitemap was last read successfully and investigate new excluded/error groups.
6. Preserve Search Console totals. Google notes that example rows can be limited even when report totals represent the full result.

No Search Console API integration is added. Manual exports avoid new OAuth credentials and are adequate at the current scale.

## Growth milestones

These are business targets, not forecasts:

| Target | Review alongside the visitor estimate |
| ---: | --- |
| 100 daily visitors | Landing-page mix, homepage search outcome rate, daily completion, first extension referrals |
| 500 daily visitors | Search reliability by origin, daily share rate, top organic pages, repeated daily engagement by date |
| 1,000 daily visitors | Channel concentration, extension downstream engagement, content depth, operational timeout/failure volume |

At every milestone, growth is healthy only if visitors also search successfully, complete or learn from the daily challenge, open reviewed content, share successful experiences, and return on later dates. Traffic alone is insufficient.

## Metrics that are not accurately measurable

- Exact unique people across days, devices, or browsers.
- Person-level retention cohorts or a user journey across sessions.
- Cross-device streaks; streak data is intentionally device-local.
- The number of extension installations or Store listing impressions; use Chrome Web Store reporting.
- Multi-touch attribution or the downstream behavior of a share recipient.
- Raw user search demand, because typed queries are intentionally excluded.
- Exact preview-to-production conversion, because preview events are intentionally suppressed.
- Search rankings or complete query inventory beyond Search Console's reported/exported data.

Do not infer these from page-view or event counts.

## Privacy and performance review

- No new SDK, vendor, cookie, beacon, database, or background request.
- No raw search, selected answer, Wikipedia title, active-tab URL, full URL, email, IP address, or persistent identifier in custom properties.
- The schema module is small and contains only constants and validation; it does not load puzzle content or add network requests.
- Extension attribution accepts only the exact `extension` value.
- Vercel page analytics remains subject to the public privacy policy and Vercel's configured collection behavior.
- The existing privacy wording already covers the implemented bounded analytics, so no policy expansion is required for this phase.

## Recommended next experiment

Collect a stable 14-day post-launch baseline, then test one change to the spoiler-free daily share prompt for a second 14-day period. Primary metric: successful daily shares / completed challenges. Guardrails: completion rate, evidence-link engagement, and no increase in duplicate events. Before attempting referral conversion measurement, add a separate fixed `source=daily_share` allowlist value; do not put puzzle answers, user IDs, or arbitrary campaign strings in shared URLs.
