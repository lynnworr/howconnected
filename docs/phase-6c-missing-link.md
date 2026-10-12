# Phase 6C — The Missing Link

Reviewed: October 12, 2026

## Implementation summary

The Missing Link is now the primary game at `/daily`, with the Phase 6B Guess the Connection concept retained only in the noindex `/daily-preview` comparison area. The production route remains visibly in preview and noindex until the launch gate is satisfied.

The implementation includes a version-controlled content registry, strict schema and editorial validation, immutable schedule positions, explicit UTC launch configuration, safe pre-launch/unavailable/exhausted states, local result and streak persistence, duplicate-safe analytics, spoiler-free sharing, verified reading links, per-edge evidence, responsive theme-aware UI, keyboard semantics, reduced-motion support, and entry points from Home, Explore, navigation, and the footer.

## Approved puzzle inventory

Total approved: **37**. Scheduled: **0**. Published: **0**. Launch requirement: **100**.

| Stable ID | Category | Path | Exact claims | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| `web-berners-lee-cern` | Science and innovation | World Wide Web (Q466) → Tim Berners-Lee (Q80) → CERN (Q42944) | Q466 P61 Q80; Q80 P108 Q42944 with P580 1984 and P582 1994 | 2026-10-11 | Approved, unscheduled |

The original approved record preserves its Phase 6B stable ID. Batches 1 and 2 each added 18 independently reviewed, unscheduled records on 2026-10-12. Their full paths, evidence, qualifiers, Wikipedia links, explanations, and distractors live in the production registry; the candidate-by-candidate decision trails are in `content/daily-batch-1-review.json` and `content/daily-batch-2-review.json`. No generated or unreviewed record was promoted to reach a quota.

## Rejected and quarantined candidates

Batch 1 rejected two candidates: `apollo-armstrong-nasa` and `space-jam-jordan-bulls`. A live exact-property intermediary query returned three valid answers for each path, so neither could support an unambiguous hidden answer. The audit records the alternate matches, qualifiers, evidence, and three distractor checks. Rejected candidates remain outside the production registry.

Batch 2 rejected `berkshire-buffett-giving-pledge` because both Warren Buffett and Bill Gates satisfy the exact two-edge path, and rejected `blind-side-oher-ravens` because Michael Oher's current Wikidata P54 statements do not contain the required Baltimore Ravens edge. The separate Batch 2 audit preserves both rejection records and their evidence.

The bounded Neo4j discovery export contains 50 raw leads dominated by generic universe and Solidarity hubs. None was promoted automatically; the file is retained only as discovery evidence. Graph discovery is deliberately opt-in and never grants approval.

## Verification and source methodology

An approved record must contain exact QIDs, PIDs, subject/object direction, qualifiers, an expected-claim description, a stable path fingerprint, verified English Wikipedia URLs (or an explicit Wikidata fallback), one Wikidata claim link and one supporting source for every edge, four unique options, an approval event, and a verification date.

Validation rejects malformed identifiers, mismatched directions, stale fingerprints, duplicate IDs, duplicate paths, reversed/near-duplicate core paths, duplicate option QIDs, missing approval history, missing source classes, schedule gaps, and duplicate schedule positions. Distractor ambiguity remains an editorial decision; validation catches structural collisions but does not pretend that a live claim response equals editorial approval.

The original puzzle uses committed CERN and Wikidata evidence inherited from the reviewed Phase 6B record. Batches 1 and 2 used current Wikidata entity/claim responses, bounded exact-path uniqueness queries, publisher or institutional supporting sources, and verified English sitelinks. Wikipedia links are explicit content fields and are never guessed from labels.

## Content-management workflow

The registry is `content/daily-puzzles.json`; the portable queue is `content/daily-review-queue.json`.

- `npm run daily:discover` runs a bounded 50-result two-edge Neo4j query and exports candidates without approving them.
- `npm run daily:export-review` exports candidate and under-review records.
- `npm run daily:validate` checks schema, claims, directions, qualifiers, links, evidence, distractors, fingerprints, duplicates, review history, and schedule integrity.
- `npm run daily:duplicates` performs a dedicated exact, reversed, and near-duplicate scan.
- `node scripts/manage-daily-puzzles.mjs set-status <id> under-review "note"` records a review transition.
- `node scripts/manage-daily-puzzles.mjs set-status <id> approved "note"` performs explicit editorial approval after human review.
- `node scripts/manage-daily-puzzles.mjs schedule <id> <position>` assigns an immutable daily position; appending positions preserves published assignments.
- The same `set-status` command supports `quarantined`, `retired`, and `rejected`, with a required audit note.
- `npm run daily:report` prints the launch gate and content runway.

Status values are candidate, under-review, approved, scheduled, published, quarantined, retired, and rejected. Content changes do not require game-component changes.

## Daily schedule and exhaustion

`NEXT_PUBLIC_DAILY_LAUNCH_DATE=YYYY-MM-DD` is the explicit UTC anchor. It is intentionally unset. Puzzle 1 would appear at 00:00 UTC on that date, position 2 on the next UTC day, and so on. The resolver never wraps, shuffles, substitutes an unreviewed record, or silently repairs a quarantined/retired assignment.

Because nothing is scheduled and no launch date is configured, there is no projected exhaustion date. There are 37 unpublished approved puzzles, above the 30-puzzle reserve target but below the 100-puzzle launch requirement.

## Monthly replenishment

Run bounded discovery, export a review batch, verify both edges and all distractors independently, record review transitions, validate, then append schedule positions. Target 30 newly approved puzzles per month and keep at least 30 unpublished approved puzzles. Run `daily:report` after every batch; a reserve below 30 emits a warning.

The next bounded batch should prioritize sports, geography and world culture, which remain the thinnest areas, while avoiding generic geography, shared categories, corporate hubs, ambiguous intermediates, unsupported labels, or a distractor that satisfies the same path.

## Learning and sharing

Before submission, the middle entity, relationship labels, qualifiers, reading links, and evidence links are absent from the rendered experience. After submission, the full directed path appears with dates and qualifiers, followed by separate **Explore the connection** and **Explore the evidence** sections. Reading and evidence links open safely in new tabs and emit bounded link-type events.

The result share contains only the challenge name/number, a completion statement, the invitation, and `/daily`. Analytics is recorded only after native share or clipboard success.

## Local preview

1. Run `npm run dev`.
2. Open `http://localhost:3000/daily` for the primary preview.
3. Open `http://localhost:3000/daily-preview` for the secondary-format comparison.
4. Run `npm run daily:report` to inspect the content gate.

Local progress does not synchronize between devices. Previously completed date/puzzle results restore the reveal when revisited.

## Verification results

- ESLint: passed.
- TypeScript (`tsc --noEmit`): passed.
- Automated tests: 226 passed, 0 failed.
- Production build: passed; `/daily` and `/daily-preview` compile as dynamic UTC-aware routes.
- `git diff --check`: passed.
- Registry validation: 37 records validated; no exact, reversed, or near-duplicate path was found.
- Extension package and manifest: unchanged.

## Remaining blockers and launch decision

Public launch is **not ready**. Sixty-three more independently verified, distinct, approved Missing Link puzzles are required; the 100 positions must then be scheduled; all Wikipedia links and distractors must pass review; mobile/desktop manual accessibility QA must be completed; and an explicit launch date must be configured.

The application correctly keeps `/daily` noindex and labels it preview content until those conditions are met. The 100-puzzle public-launch requirement is **not satisfied**.
