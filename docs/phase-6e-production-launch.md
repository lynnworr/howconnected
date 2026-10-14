# Phase 6E - Production launch preparation

Prepared: October 14, 2026

## Deployment-ready state

- Registry records: **100 scheduled**
- Schedule positions: **1-100, with no gaps or duplicates**
- Day 1: `toy-story-hanks-apollo-13`
- Day 100: `muppet-show-henson-maryland`
- Per-record calendar dates: **unset** (the application derives them from the UTC launch date)
- Production launch date: **unset**
- Public launch gate: **inactive**

`content/daily-schedule-review.json` remains the frozen, reviewable source of truth. The promotion script applies that exact order to the registry and is idempotent. It does not choose a date, randomize the order, or modify approved puzzle facts.

## Safe launch procedure

The launch date is controlled only by `NEXT_PUBLIC_DAILY_LAUNCH_DATE`, in `YYYY-MM-DD` UTC format. Do not set it to the current UTC date after that date has begun.

1. Push and deploy this implementation with the variable unset. `/daily` must show the pre-launch state and remain `noindex`.
2. Verify the production deployment commit, `/daily`, `/daily-preview`, and the checks below.
3. Choose the next UTC calendar date that begins after verification is complete. If verification is close to 00:00 UTC, choose the following date instead.
4. Add `NEXT_PUBLIC_DAILY_LAUNCH_DATE=YYYY-MM-DD` to the Vercel **Production** environment and redeploy the same verified commit.
5. Before 00:00 UTC, confirm `/daily` is still pre-launch and `noindex`. At or after 00:00 UTC, confirm it exposes Challenge #1 and becomes indexable.
6. If the dated deployment cannot be verified before the launch instant, change the variable to a later future date and redeploy. Never leave an elapsed launch date on an unverified deployment.

The route rejects invalid or future `?date=` values, so a visitor cannot use the query string to expose an unpublished puzzle. `/daily-preview` remains experimental and `noindex` regardless of the public gate.

## Expected day-1 behavior

At 00:00:00 UTC on the configured date, `/daily` serves `toy-story-hanks-apollo-13` as Challenge #1. It supports the existing answer, reveal, verified reading/evidence links, local completion and streak state, and spoiler-free sharing. Day 100 serves `muppet-show-henson-maryland`; day 101 shows the non-cycling content-exhausted state.

## Production verification

Before launch:

- `/daily` returns 200, shows the pre-launch message, and emits `noindex`.
- `/daily-preview` returns 200, is visibly marked preview, and emits `noindex`.
- `/sitemap.xml` does not contain `/daily` while the launch date is absent.

After the UTC launch instant:

- `/daily` returns 200, shows `Challenge #1`, and contains neither preview nor pre-launch wording.
- The canonical URL is `https://www.howconnected.app/daily`.
- `/daily` is indexable and appears in the sitemap; `/daily-preview` remains `noindex`.
- Wikipedia and evidence links open the reviewed destinations.
- A correct and an incorrect choice both reveal the complete path and explanation.
- Sharing does not disclose the answer.

Hands-on owner QA is still required for responsive layout, light/dark themes, focus appearance, keyboard and touch interaction, VoiceOver/NVDA announcements, reduced motion, native share/clipboard behavior, and publisher links that reject automated clients. See the Phase 6D report for the complete exception list.

## Git and Vercel commands

Run only after reviewing the working tree and selecting the intended files:

```powershell
git status --short
git diff --check
git add .env.example app/daily/page.tsx components/DailyChallenge.tsx content/daily-puzzles.json content/daily-batch-5-review.json content/daily-schedule-review.json docs/phase-6d-launch-preparation.md docs/phase-6e-production-launch.md lib/daily-puzzles.ts lib/seo.ts package.json scripts/promote-daily-schedule.mjs scripts/validate-daily-schedule.mjs scripts/verify-daily-batch-5.mjs scripts/verify-daily-links.mjs scripts/write-daily-batch-5.mjs tests/daily-accessibility.test.mjs tests/daily-challenge.test.mjs tests/daily-schedule.test.mjs tests/seo.test.mjs
git commit -m "Prepare Missing Link production launch"
git push origin main
```

With the Git-connected production deployment verified, configure the date in Vercel's Production environment, or use the CLI and enter the chosen future UTC date when prompted:

```powershell
vercel env add NEXT_PUBLIC_DAILY_LAUNCH_DATE production
vercel --prod
```

Confirm that Vercel deployed the expected commit SHA. Then inspect `https://www.howconnected.app/daily`, `https://www.howconnected.app/daily-preview`, `https://www.howconnected.app/robots.txt`, and `https://www.howconnected.app/sitemap.xml` before and after the launch boundary. Do not promote a deployment or configure the date until the manual checks are complete.
