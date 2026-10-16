# Phase 7F — Publisher pilot and commercial validation

Prepared: October 15, 2026

## Pilot objective

Recruit 10–20 relevant outreach prospects, identify 3–5 interested independent publishers, reach at least three live third-party installations, collect feedback from every participant, and observe at least one credible willingness-to-pay signal. These are validation goals, not achieved results or forecasts.

The pilot is aimed at science writers, history blogs, educational publishers, schools, and independent content creators. It does not include billing, subscription management, guaranteed fulfillment, automated publication, or unrestricted graph access.

## Request intake and privacy

`/widgets/request` posts JSON to `/api/widget-requests`. The route reuses the existing server-only Resend configuration and Upstash-backed production rate limiter.

Safeguards:

- fixed required fields and bounded enum values;
- per-field and total payload length limits;
- email header control-character rejection;
- optional website URLs limited to HTTP or HTTPS, stripped of fragments, never fetched by the application, and rejected when they include credentials;
- an off-screen honeypot field;
- shared production rate limiting and fail-closed behavior if rate limiting is unavailable;
- plain-text owner email only, with the submitter used as `Reply-To`;
- no automatic confirmation email, CRM record, database write, graph ingestion, or publication;
- no request details in analytics.

Successful submission means only that the email provider accepted the private owner notification. It is not an order, editorial approval, publication commitment, or guarantee of a reply. Do not send test requests against production unless the private owner has approved the recipient and timing.

## Manual editorial fulfillment workflow

1. **Triage the request.** Confirm the intended use is in scope, contains enough context, and does not ask for unsafe, defamatory, promotional, private, or unsupported content.
2. **Resolve endpoints.** Identify the intended entities and record the exact Wikidata QIDs. Reject or clarify ambiguous names before research proceeds.
3. **Find a meaningful path.** Use the existing research tools to identify a concise relationship path. Do not publish a path merely because the graph can produce one.
4. **Verify statements and qualifiers.** Check relationship direction, ranks, dates, offices, locations, series membership, and other qualifiers against primary or authoritative sources.
5. **Review ambiguity and history.** Check entity identity, changed names, predecessor/successor organizations, disputed claims, and anachronistic or misleading shortcuts.
6. **Write the explanation.** Describe the supported relationship in understandable educational language without adding claims that the sources do not establish.
7. **Approve or reject.** Apply the existing editorial snapshot validation. Record a clear internal reason for rejection or a request for clarification. Never expose a pending request through the embed allowlist.
8. **Create the stable slug.** Add a unique, descriptive slug only after approval, using the existing editorial registry and snapshot structure. Preserve canonical orientation and source links.
9. **Preview and test.** Verify the direct embed, HTTPS cross-origin iframe, desktop and mobile layout, evidence disclosure, all external links, analytics allowlists, unknown-slug 404 behavior, CSP, and non-embed framing protections.
10. **Send the snippet.** Reply manually only after approval and deployment. Include the fixed iframe sandbox and referrer policy, installation instructions, the stable slug, and a request for post-install feedback. Never promise future availability or custom terms that have not been agreed.

Requested content remains private email until it is explicitly reviewed and committed as an approved editorial snapshot. A request form submission must never call graph ingestion or mutate `lib/editorial-connections.ts`.

## Owner-only tracker process

`docs/publisher-pilot-tracker.template.csv` is an empty schema, not an active contact list. Copy it to private owner-controlled storage outside the public repository before adding prospect or contact information. Do not commit the filled tracker, attach it to public issues, or place it under `public/`.

Suggested maintenance:

1. Assign one row per organization, not one row per person.
2. Use controlled statuses such as `not_contacted`, `contacted`, `interested`, `pilot_active`, `declined`, and `closed`.
3. Keep requested-widget and editorial statuses separate so commercial interest cannot bypass review.
4. Record only the minimum operational notes needed for follow-up.
5. Set a specific follow-up date and review the tracker weekly.
6. Remove stale contact details when no longer needed and restrict access to the owner or authorized pilot operator.

## Analytics and conversion measurement

All new events pass through the existing runtime allowlist.

| Event | Meaning | Bounded properties |
| --- | --- | --- |
| `publisher_landing_opened` | First `/widgets` mount in a browser session | None |
| `publisher_demo_interacted` | Explicit “open demo” action | Fixed `action=open_demo` |
| `widget_embed_snippet_copied` | Clipboard write succeeded, once per browser session | None |
| `publisher_request_cta_clicked` | Request CTA selected | Fixed placement: `hero`, `examples`, or `limitations` |
| `publisher_request_submitted` | API returned success and the form locked against repeat submission | Fixed request scope and optional commercial-interest choice |
| `widget_link_opened` | Link selected within an approved widget | Approved connection slug and fixed destination |

Publisher names, emails, website URLs, requested topics, article context, free-form messages, IP addresses, and full URLs are forbidden event properties. Commercial-interest selections are nonbinding aggregate signals.

Reliability limits:

- Vercel page views remain the better source for total `/widgets` traffic; the custom open event is session-best-effort, not a unique-person count.
- Cross-origin iframe behavior prevents the landing page from observing arbitrary interaction inside the demo. The explicit demo link and the widget's own bounded link events are measurable; evidence-disclosure expansion is not reliably reported.
- Clipboard events count successful API calls, not successful publication.
- A successful request event means delivery acceptance, not a qualified lead, approved widget, installation, or revenue.
- Browser storage restrictions, blockers, offline use, and unsupported Vercel plans can reduce counts.

## Commercial model comparison

| Model | Publisher value | Research/review labor | Hosting cost | Sales complexity | Repeat use | Support burden | Scalability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Free branded pre-approved widgets** | Immediate evidence-linked enhancement for matching stories | Low after approval | Low, static routes | Low | Limited to catalog fit | Low | High |
| **B. One-time paid custom relationship widget** | A tailored, reviewed asset for a specific article or lesson | High and visible per request | Low | Moderate; scope and acceptance must be explicit | Variable | Moderate | Moderate until editorial workflow is standardized |
| **C. Monthly publisher subscription** | Recurring requests, service expectations, possible analytics/customization | Potentially high and unpredictable | Low to moderate | High; requires accounts, entitlements, billing, support policy, and churn management | Potentially high | High | Unproven before repeat demand |
| **D. Custom licensing or API integration** | Workflow integration, higher volume, contractual rights | High upfront and ongoing governance | Moderate; metering and reliability commitments needed | Very high | High for a small number of customers | Very high | Potentially high but premature |

### Recommended first experiment

Test **one-time paid custom relationship widgets** as a manual concierge offer without charging during this phase. Ask qualified pilot participants for a nonbinding price reaction after they receive and install one reviewed widget—for example, whether they would have paid a stated one-time range for the research, verification, implementation support, and stable hosted embed.

Success evidence should include at least one publisher who states a credible price or budget and explains the conditions under which they would pay. Do not treat a form selection alone as willingness to pay. Do not accept payment until scope, refund/cancellation handling, terms, invoicing/tax obligations, editorial rejection policy, and delivery expectations are defined.

This experiment tests the labor-intensive unit before adding subscription machinery. Free approved widgets remain the acquisition channel; subscriptions and licensing should wait for repeated requests from the same publishers.

## Deployment and operations

No new environment variables, database, CRM, or production setting is required. The request route uses the existing variables documented in `docs/contact-email-setup.md`:

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Before accepting real requests:

1. Confirm these variables exist in the intended Vercel environment.
2. Confirm the owner recipient is authorized to receive publisher inquiries.
3. Deploy through the existing pipeline; do not change framing, AdSense, Neo4j, daily puzzle, or extension settings.
4. Submit one owner-authorized test request and confirm plain-text delivery, `Reply-To`, rate-limit behavior, and no sensitive analytics properties.
5. Test `/widgets` and `/widgets/request` on desktop and at 375 px.
6. Recheck approved and unknown embed routes plus regular-site framing headers.
7. Copy the empty tracker to private storage and establish a weekly review owner.

## Outreach guardrails

Outreach is manual and outside this implementation. Do not send messages automatically, scrape personal contact data, or imply customers, revenue, guaranteed turnaround, exclusive licensing, or a supported paid plan. Use the validation targets as goals and report achieved results separately.
