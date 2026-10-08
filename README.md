This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## HowConnected configuration

Copy `.env.example` to `.env.local` and provide these server-only values:

```bash
NEO4J_URI=neo4j+s://your-database-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
ADMIN_PASSWORD=use-a-long-random-password
DISCOVERY_TIMEOUT_MS=14000
DISCOVERY_SEMANTIC_STAGE_MS=8000
```

Never prefix these secrets with `NEXT_PUBLIC_`. `.env.local` remains ignored by Git. `ADMIN_PASSWORD` protects the private `/admin` feedback dashboard; use a long, unique value. Browser requests use relative URLs, so the application has no production dependency on localhost. `DISCOVERY_TIMEOUT_MS` is optional, constrained to 10–30 seconds, and defaults to 14 seconds. `DISCOVERY_SEMANTIC_STAGE_MS` defaults to 8 seconds and must remain below the total timeout so the bounded Wikipedia-assisted fallback has time to run.

Run the repeatable cross-domain development benchmark against a local development server with `npm run benchmark:discovery`. Set `BENCHMARK_BASE_URL` only when intentionally testing another non-production environment.

Run the broader 98-pair, 14-domain product-quality audit with `npm run benchmark:domains`. It prints a domain ranking and writes development-only JSON and CSV reports under `benchmarks/domain-audit/`; generated reports are ignored by Git. Requests are paced to reduce Wikimedia load. If a run contains transient HTTP failures, rerun with `BENCHMARK_RESUME=1` to retry only those pairs and merge them into the latest report.

### Vercel deployment

1. Import the repository into Vercel as a Next.js project.
2. Add all three Neo4j variables and `ADMIN_PASSWORD` in **Project Settings → Environment Variables** for Production and any Preview environments that should expose the admin dashboard.
3. Use the encrypted Aura `neo4j+s://` URI.
4. Enable **Web Analytics** in the project dashboard.
5. Deploy, then verify `/api/neo4j-test`, a connection, and a feedback submission.

The Neo4j driver is created lazily and reused by warm Node.js Function instances. Credentials are read only at server runtime and are never included in browser bundles or analytics events. If Aura network restrictions are enabled, allow the Vercel deployment environment or use Aura's supported public TLS endpoint.

### Analytics and privacy

Vercel Web Analytics records anonymous page analytics and these product events:

- `entity_search`
- `connection_submit`
- `connection_success`
- `connection_no_result`
- `connection_error`
- `alternate_paths_opened`
- `share_clicked`
- `copy_link_clicked`
- `entity_source_opened`
- `try_another_clicked`
- `path_feedback_submitted`

Events contain QIDs and coarse result metadata, never search text, credentials, names, free-form feedback, or personally identifiable information. Filter connection outcomes to `origin: homepage` when calculating submit success/no-result rates because direct share URLs also emit outcomes. `connection_submit` includes a session-local sequence number without transmitting a session identifier.

### Feedback storage

Feedback is stored in Neo4j as isolated `PathFeedback` nodes with no relationships, so it cannot participate in entity discovery or pathfinding. Stored fields are `id`, `fromQid`, `toQid`, `rating`, controlled `reason`, `pathSteps`, and server-generated `timestamp`. Unknown fields and free-form reasons are rejected.

### Validation

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```
