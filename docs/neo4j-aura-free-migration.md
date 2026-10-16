# Neo4j AuraDB Free migration validation

This runbook validates the restored Free instance without changing Vercel or the current Professional database. Keep the Professional instance running until every acceptance check and the post-cutover smoke test passes.

## Local staging configuration

Create an ignored file named `.env.neo4j-free.local` in the repository root. Do not reuse or edit `.env.local`.

```dotenv
NEO4J_FREE_URI=neo4j+s://REPLACE_WITH_FREE_INSTANCE.databases.neo4j.io
NEO4J_FREE_USERNAME=REPLACE_WITH_FREE_INSTANCE_USERNAME
NEO4J_FREE_PASSWORD=REPLACE_WITH_FREE_INSTANCE_PASSWORD
```

The `.env*` ignore rule prevents this file from being committed. Never paste its contents into tickets, chat, logs, or reports. The validation output contains database facts and timings but not configuration values. The standard validation command deliberately uses the authenticated account's home/default database, matching the application. Do not set a database name unless Aura explicitly provides one and it has been separately verified.

## Validation commands

Run the current Professional target read-only to capture a same-day comparison:

```powershell
npm.cmd run validate:neo4j-current
```

Run the restored Free target, including the isolated write-and-cleanup test:

```powershell
npm.cmd run validate:neo4j-free
```

Immediately before cutover, compare transaction-consistent read snapshots from Professional and Free:

```powershell
npm.cmd run compare:neo4j-cutover
```

The comparison hashes normalized node labels and properties, Entity QID coverage, relationship endpoints/types/properties, and feedback content without printing record contents. `exactGraphContentMatch` must be `true`. Different `lastCommittedTxn` values are expected after validation writes and cleanup; they do not indicate divergence when both content hashes match.

AuraDB Free does not expose detailed Metrics. The comparator attempts supported read-only database metadata and JMX store-size probes, but lack of a numeric result is expected on Free and must be recorded as a storage-observability limitation rather than inferred from graph counts.

The Free test uses two uniquely tagged `Entity:MigrationValidation` nodes and one `HC_MIGRATION_VALIDATION` relationship. Cleanup runs in a `finally` block. The test passes only if the temporary data is verified, deleted, and the before/after node and relationship counts are identical. If the process is interrupted, use the Aura Query tool to inspect before deleting only the tagged fixture:

```cypher
MATCH (node:MigrationValidation)
RETURN node.validationRunId, node.qid, node.name;
```

After confirming that every returned row belongs to this validator:

```cypher
MATCH (node:MigrationValidation)
DETACH DELETE node;
```

## Application configuration findings

- Runtime variables: `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD`.
- No runtime database-name variable is present. The driver resolves the authenticated account's home/default database. This Free instance rejects an explicit `neo4j` database selection, so cutover must preserve the application's existing default-database behavior.
- The same authenticated driver performs reads and writes. A successful isolated test proves the supplied account can read, create, update, and delete graph data.
- Ingestion uses standard transactional Cypher: `MERGE`, `SET`, `UNWIND`, `datetime()`, explicit relationship types, and a uniqueness constraint on `Entity.qid`.
- Relationship types originate from a fixed application configuration and must pass `^[A-Z][A-Z0-9_]*$` before being placed in a query.
- No APOC, Graph Data Science, multi-database, clustering, or Professional-only feature is used by the application path.

## Cutover plan

1. Keep Professional serving production and resume Free if Aura has auto-paused it.
2. Record the names—not values—of all Vercel environments containing the three Neo4j variables. Export or otherwise securely preserve the current values using the owner’s password manager and Vercel’s approved secret workflow.
3. Stop voluntary ingestion briefly. Feedback writes may continue to Professional until the final snapshot is taken; note the cutover time.
4. Compare current Professional counts and representative paths with the Free validation report.
5. Re-export Professional and restore Free again if nodes, relationships, feedback records, or ingestion updates were added after the existing snapshot. Re-run the full Free validation after any restore.
6. Take the available on-demand Free snapshot immediately before cutover and retain an export of Professional. Do not delete Professional.
7. Update only `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` in the intended Vercel environment. Do not add the `NEO4J_FREE_*` validation names to Vercel.
8. Redeploy through the normal pipeline so every function starts with the new driver configuration.
9. Verify a QID lookup, Einstein to Newton, Steve Jobs to Apple, another representative search, one owner-authorized ingestion, and one owner-authorized feedback write. Confirm the Free counts change only as expected.
10. Monitor errors, timeouts, Aura status, storage, and graph growth closely. Keep Professional untouched until the rollback window has passed.

## Rollback

1. Stop voluntary ingestion to prevent further divergence.
2. Restore the three saved Professional values in the same Vercel environment.
3. Redeploy and repeat the production search smoke tests.
4. Reconcile writes made only to Free after the cutover before attempting another migration. There is no automatic dual-write or conflict resolution.
5. Keep both databases until reconciliation and the renewed cutover are complete.

AuraDB Free has no uptime SLA, uses shared/zonal infrastructure, is limited to 200,000 nodes, 400,000 relationships, 1 GB storage, and one on-demand backup at a time. It automatically pauses after 72 hours without activity and can be deleted after remaining paused for more than 30 days. Treat it as an early-production cost tradeoff, not a production-availability guarantee.
