# Phase 7C — Sharing and distribution

## Audit outcome

The existing implementation already had working native Web Share support, clipboard fallbacks, canonical connection URLs, spoiler-free Daily Challenge copy, success-only share events, approved editorial Open Graph images, and fixed `source=extension` attribution. Those paths were retained rather than replaced.

The material gaps were that user-shared links had no bounded referral source, the daily completion copy said “solved” even after an incorrect answer, `/daily` had no dedicated large social preview, and successful connection pages did not offer a direct next step into the daily game.

## Implemented behavior

- Daily Challenge shares use `/daily?source=daily_share`. The copy contains The Missing Link, the challenge number (or UTC date fallback), a neutral completed status, a play invitation, and the public Daily URL. It never includes correctness, the selected option, the intermediary, relationship labels, the explanation, or a per-user value.
- Connection copy/share actions use the existing directional connection path with `?source=connection_share`. Canonical metadata remains query-free.
- Only `extension`, `daily_share`, and `connection_share` are recognized attribution values. Unknown values do not become analytics properties.
- Daily referral visits use the existing `daily_challenge_opened` event with `origin=daily_share`. Connection referral visits use existing connection outcome events such as `search_succeeded` with `origin=connection_share`. Existing duplicate-safe daily claims and share-success timing remain unchanged.
- `/daily` now has a static, spoiler-free 1200×630 Open Graph image and a large-image Twitter card.
- The post-answer panel explains that sharing is spoiler-free, makes the share action primary, and gives the next UTC return time. Connection results link contextually to The Missing Link, and the extension information page exposes a normal crawlable Daily link.

No user IDs, raw answers, browsing data, referrers, unique tokens, or new analytics SDKs were added. Puzzle content, the UTC schedule, launch configuration, Neo4j behavior, and the submitted extension 1.1.0 archive are unchanged.

## Measurement

Use the existing product events and segment by the bounded `origin` field:

| Referral | Landing signal | Downstream signals |
| --- | --- | --- |
| Daily share | `daily_challenge_opened`, `origin=daily_share` | answer, completion, Wikipedia/evidence, share, and exploration events with the same origin |
| Connection share | connection outcome, `origin=connection_share` | `result_shared` and other connection engagement with the same origin |
| Extension | existing `extension_referral_opened` and `origin=extension` | unchanged |

The query parameter identifies only a distribution channel. It is not persisted by this implementation and is excluded from canonical URLs.

## Manual browser QA

Before deployment, verify native share sheets on current iOS Safari and Android Chrome, clipboard behavior in desktop Chrome/Firefox/Safari, focus and announcement behavior with VoiceOver or NVDA, the generated social card in a sharing debugger, and attribution events in the production analytics dashboard. Cancellation must not report a successful Daily share.

## Recommended first experiment

For the first two weeks, use the new neutral completion card as the only Daily share treatment. Compare `daily_challenge_opened` visits with `origin=daily_share` against completed Daily sessions, then compare their completion and next-action rates with unattributed Daily visits. Do not change the copy during the window; use aggregate counts only and set no user-level identifier.

## Future extension 1.2 ideas

Do not change the submitted 1.1.0 package. For a later 1.2 review, consider showing today’s completion state locally in the popup and offering a share action after the site returns a completed state. Any design should retain the existing narrow permissions and fixed `source=extension` value; it should not add background work, browsing-history access, or an analytics SDK.

## Deployment

Review the diff, run the full validation suite, commit through the normal repository workflow, push the reviewed branch, and deploy it through the existing Vercel project. After deployment, verify `/daily`, one approved `/connect/...` page, `/extension`, both attributed share URLs, canonical tags, the Daily Open Graph image, and production analytics. No environment-variable change or extension-store submission is required.
