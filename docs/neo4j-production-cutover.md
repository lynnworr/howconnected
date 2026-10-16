# Neo4j AuraDB Free production cutover

This runbook keeps public static and read-only behavior available while temporarily blocking every application write to Neo4j. It does not authorize changing Vercel, deploying, or switching databases without the owner.

## Write inventory

| Public surface | Neo4j behavior | Maintenance behavior |
| --- | --- | --- |
| `GET /api/ingest?qid=...` | Explicit entity and relationship ingestion | Returns `503` with `neo4j_write_maintenance` before Wikidata fetch or Neo4j access |
| `POST /api/feedback` | Creates a `PathFeedback` node | Valid input returns `503` before Neo4j access; analytics is not emitted |
| `GET /api/discover?fromQid=...&toQid=...` | Reads first; may implicitly refresh or ingest entities and relationships | Existing fully expanded paths may still return; any attempted expansion returns `503` without writing |
| `/connect/[fromQid]/[toQid]` for non-editorial pairs | Reads first; server rendering may invoke the same discovery ingestion | Existing read-only results may render; a required expansion falls back to the existing friendly error state |

The shared write sinks are `ingestWikidataEntityWithMetadata()` and `storePathFeedback()`. Both call `assertNeo4jWritesAllowed()` immediately before any write-capable work. Current production code has no other Neo4j write sink.

The following remain available because they are static or read-only with respect to Neo4j: approved editorial connection snapshots, embeds, The Missing Link, `/api/connect`, search, entity images, widgets and publisher requests, Contact, analytics, SEO routes, AdSense integration, the extension, and admin feedback reads.

Repository scripts such as `seed.mjs` can write when an owner runs them directly, but they are not production endpoints and are not controlled by the web maintenance flag. Do not run them during cutover.

## Maintenance contract

Set this Production environment variable and create a new deployment:

```dotenv
NEO4J_WRITE_MODE=maintenance
```

Unset it, or set it to `enabled`, and redeploy to restore normal writes. Any other nonempty value fails closed and blocks writes. Maintenance responses are `503`, carry `Cache-Control: no-store` and `Retry-After: 300`, and contain the fixed code `neo4j_write_maintenance`.

Environment changes apply only to new Vercel deployments. They do not modify a running deployment or cancel requests that are already executing.

## Overlapping deployments and draining writes

1. In Vercel Deployment Protection, use Standard Protection so generated and past deployment URLs require Vercel authentication while the production custom domain remains public. Do not use a bypass URL during the cutover.
2. In Settings > Functions, record the effective maximum duration for the current production deployment. The repository does not override `maxDuration`; do not assume the dashboard value.
3. Deploy with `NEO4J_WRITE_MODE=maintenance` while the Professional credentials are still active.
4. Wait until the production domain resolves to that deployment and both explicit write probes return the maintenance response.
5. Stop all manual ingestion and do not invoke old generated deployment URLs.
6. Wait the effective function maximum duration plus 30 seconds before the final comparison. This drains requests that began on the old deployment. If the effective duration is the common 300-second default, wait 330 seconds.
7. Check Vercel logs over that entire drain window. Restart the drain clock from the last invocation of `/api/ingest`, `/api/discover`, `/api/feedback`, or a non-editorial `/connect/...` request that began on the old deployment.

After the drain completes, the current production domain cannot start a Neo4j write, protected old deployment URLs are not public, and every old in-flight function has exceeded its allowed lifetime.

## Verify maintenance without changing either graph

Use the production domain. Replace `HOST` locally; do not paste credentials into commands.

```powershell
Invoke-WebRequest -Uri "https://HOST/api/ingest?qid=Q312" -SkipHttpErrorCheck
```

Expected: `503`, `Cache-Control: no-store`, and JSON code `neo4j_write_maintenance`.

Send a syntactically valid feedback request with an owner-approved existing pair. Expected: the same `503` code and no feedback-count change. Then verify:

- an approved editorial page and embed return `200`;
- `/daily` retains its normal launch behavior;
- `/widgets`, Contact, and extension-facing search remain available;
- a known existing `/api/connect` relationship returns `200`;
- Professional and Free counts remain unchanged.

## Owner-controlled cutover sequence

1. Confirm the Professional rollback credentials are in the owner's password manager.
2. Enable Standard Deployment Protection for generated deployment URLs if it is not already enabled.
3. Set Production `NEO4J_WRITE_MODE=maintenance` and deploy the reviewed maintenance-capable commit with the Professional credentials unchanged.
4. Verify the maintenance responses and unaffected public routes described above.
5. Drain old writes using the effective Vercel maximum duration plus 30 seconds and confirm the Vercel logs are quiet.
6. Run `npm.cmd run compare:neo4j-cutover` locally. Continue only when `exactGraphContentMatch` is `true`.
7. If it is false, keep maintenance enabled, export Professional, restore Free, run `npm.cmd run validate:neo4j-free`, and repeat the comparison.
8. Take the available on-demand Free snapshot.
9. In the Vercel Production environment only, replace `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` with the saved Free values. Do not add a database-name variable. Leave `NEO4J_WRITE_MODE=maintenance` in place.
10. Redeploy and wait until the production domain points to the new deployment. Confirm in Vercel that this deployment was built after the three credential changes; never print their values.
11. While web writes remain blocked, test known read paths through production. Separately run the local Free validator if another isolated Free write check is desired.
12. Unset `NEO4J_WRITE_MODE` or set it to `enabled`, then redeploy once more.
13. Confirm an ingestion attempt is no longer returning `neo4j_write_maintenance`. Do not use an arbitrary QID merely as a probe.
14. Submit one owner-authorized feedback record or ingestion through production. Immediately compare Professional and Free: the expected change must appear only in Free. This conclusively confirms the active production write target.
15. Test representative searches, including Einstein to Newton and Steve Jobs to Apple.
16. Monitor Vercel logs for Neo4j authentication, routing, timeout, discovery, ingestion, and feedback errors. Keep Professional intact throughout the rollback window.

Steps 9 and 12 require separate deployments. This is intentional: the Free credential deployment remains write-blocked until its read path is verified, and maintenance cannot accidentally disappear just because the database credentials changed.

## Rollback

1. Immediately set Production `NEO4J_WRITE_MODE=maintenance` and deploy if it is not already active.
2. Verify the maintenance response, protect generated deployment URLs, and drain in-flight Free writes using the same duration rule.
3. Record or export every write made only to Free after cutover.
4. Restore the saved Professional values for the three Neo4j variables. Keep maintenance enabled and redeploy.
5. Verify known reads against Professional.
6. Unset the maintenance variable or set it to `enabled`, redeploy, and verify one owner-authorized write.
7. Reconcile Free-only feedback and ingestion before another cutover. Do not delete either database.

Never use Vercel's instant deployment rollback by itself for this migration: a prior deployment also contains its prior environment snapshot, and rolling code back without first stopping and draining writes can reintroduce an uncontrolled database target.
