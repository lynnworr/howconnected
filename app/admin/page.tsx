import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { isCurrentAdminAuthenticated } from "@/lib/admin-auth";
import {
  PATH_FEEDBACK_REASON_LABELS,
  parseAdminFeedbackFilter,
  parseAdminFeedbackReason,
  type AdminFeedbackDashboard,
  type AdminFeedbackFilter,
} from "@/lib/admin-feedback-core";
import { getAdminFeedbackDashboard } from "@/lib/admin-feedback";
import {
  getLatestExternalCoverageGapSummary,
  getLatestCoverageGapSummary,
  type CoverageGapSummary,
  type ExternalCoverageGapSummary,
} from "@/lib/accuracy-gap-report";
import type { PathFeedbackReason } from "@/lib/path-feedback";

type AdminPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    filter?: string | string[];
    reason?: string | string[];
  }>;
};

function BrandMark() {
  return (
    <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#17233f]">
      <span className="absolute left-[7px] size-1.5 rounded-full bg-[#ff795b]" />
      <span className="absolute right-[7px] size-1.5 rounded-full bg-[#58bea0]" />
      <span className="h-px w-4 rotate-[-18deg] bg-white/75" />
    </span>
  );
}

function LoginForm({ error }: { error: string | undefined }) {
  const message =
    error === "rate_limited"
      ? "Too many attempts. Please wait before trying again."
      : error
        ? "The password was not accepted."
        : null;

  return (
    <section className="mx-auto w-full max-w-md rounded-[28px] border border-[#e0e4e9] bg-white/90 p-7 shadow-[0_24px_80px_rgba(25,35,55,0.09)] sm:p-9">
      <div className="flex items-center gap-3">
        <BrandMark />
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#5c6679]">
            HowConnected
          </p>
          <h1 className="text-xl font-bold text-[#17233f]">Alpha Admin</h1>
        </div>
      </div>
      <p className="mt-6 text-sm leading-6 text-[#667086]">
        Enter the admin password to review private path-quality feedback.
      </p>
      <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
        <div>
          <label htmlFor="admin-password" className="text-sm font-semibold text-[#26334f]">
            Password
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="mt-2 w-full rounded-xl border border-[#ccd2dc] bg-white px-4 py-3 text-base text-[#17233f] outline-none transition focus:border-[#ff6846] focus:ring-2 focus:ring-[#ff6846]/20"
          />
        </div>
        {message ? (
          <p role="alert" className="text-sm font-medium text-[#b6442c]">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-full bg-[#17233f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#ff6846] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
        >
          Sign in
        </button>
      </form>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#e0e4e9] bg-white/90 p-5 shadow-[0_8px_30px_rgba(25,35,55,0.04)]">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#758095]">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-[#17233f]">{value}</p>
    </div>
  );
}

function filterHref(
  filter: AdminFeedbackFilter,
  reason?: PathFeedbackReason,
): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (filter === "negative" && reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "Unknown"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function entityLabel(name: string | null, qid: string): string {
  return name ? `${name} (${qid})` : qid;
}

function Dashboard({
  data,
  gaps,
  externalGaps,
  filter,
  reason,
}: {
  data: AdminFeedbackDashboard;
  gaps: CoverageGapSummary | null;
  externalGaps: ExternalCoverageGapSummary | null;
  filter: AdminFeedbackFilter;
  reason: PathFeedbackReason | null;
}) {
  const filters: Array<{ value: AdminFeedbackFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "positive", label: "Positive" },
    { value: "negative", label: "Negative" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#5c6679]">
              HowConnected
            </p>
            <h1 className="text-2xl font-extrabold text-[#17233f]">Alpha feedback</h1>
          </div>
        </div>
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-[#ccd2dc] bg-white px-4 py-2 text-sm font-bold text-[#38445c] transition hover:border-[#ff6846] hover:text-[#b6442c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
          >
            Log out
          </button>
        </form>
      </header>

      <section aria-label="Feedback summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total submissions" value={data.summary.total} />
        <MetricCard label="Thumbs up" value={data.summary.positive} />
        <MetricCard label="Not really" value={data.summary.negative} />
        <MetricCard label="Positive feedback" value={`${data.summary.positivePercentage}%`} />
      </section>

      <section aria-labelledby="coverage-gaps-heading" className="mt-8 rounded-2xl border border-[#e0e4e9] bg-white/90 p-5 shadow-[0_8px_30px_rgba(25,35,55,0.04)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#758095]">Internal graph scan</p>
            <h2 id="coverage-gaps-heading" className="mt-1 text-xl font-extrabold text-[#17233f]">Internal Gap Scan</h2>
          </div>
          {gaps ? <p className="text-xs text-[#758095]">Latest scan {formatTimestamp(gaps.generatedAt)}</p> : null}
        </div>
        {gaps ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Pairs tested" value={gaps.totalPairs} />
              <MetricCard label="False negatives" value={gaps.falseNegatives} />
              <MetricCard label="False-negative rate" value={`${(gaps.falseNegativeRate * 100).toFixed(1)}%`} />
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                <thead className="border-b border-[#e0e4e9] text-xs uppercase tracking-[0.08em] text-[#667086]">
                  <tr>
                    <th className="px-3 py-3 font-bold">Gap</th>
                    <th className="px-3 py-3 font-bold">Cause</th>
                    <th className="px-3 py-3 font-bold">Failures</th>
                    <th className="px-3 py-3 font-bold">Representative pairs</th>
                    <th className="px-3 py-3 text-right font-bold">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e9ed]">
                  {gaps.topClusters.map((cluster) => (
                    <tr key={cluster.id} className="align-top">
                      <td className="px-3 py-3">
                        <p className="font-bold text-[#26334f]">{cluster.relationshipFamilyLabel}</p>
                        <p className="mt-1 text-xs text-[#758095]">{cluster.properties.join(", ")} · {cluster.sourceDomain} → {cluster.targetDomain}</p>
                      </td>
                      <td className="px-3 py-3 text-[#566176]">{cluster.failureCause}</td>
                      <td className="px-3 py-3 font-semibold text-[#26334f]">{cluster.failures}/{cluster.tested}</td>
                      <td className="px-3 py-3 text-xs leading-5 text-[#566176]">
                        {cluster.representativePairs.map((pair) => (
                          <div key={`${pair.sourceQid}-${pair.targetQid}`}>{pair.sourceName} → {pair.targetName}</div>
                        ))}
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold text-[#b6442c]">{cluster.priorityScore}</td>
                    </tr>
                  ))}
                  {gaps.topClusters.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-[#758095]">No false-negative clusters in the latest scan.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-[#667086]">No completed gap scan is available yet. Run <code className="rounded bg-[#f1f2f4] px-1.5 py-0.5">npm run benchmark:gaps</code>.</p>
        )}
      </section>

      <section aria-labelledby="external-coverage-gaps-heading" className="mt-6 rounded-2xl border border-[#e0e4e9] bg-white/90 p-5 shadow-[0_8px_30px_rgba(25,35,55,0.04)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#758095]">External Wikidata scan</p>
            <h2 id="external-coverage-gaps-heading" className="mt-1 text-xl font-extrabold text-[#17233f]">External Wikidata Coverage Scan</h2>
          </div>
          {externalGaps ? <p className="text-xs text-[#758095]">Latest scan {formatTimestamp(externalGaps.generatedAt)}</p> : null}
        </div>
        {externalGaps ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="External pairs tested" value={externalGaps.totalPairs} />
              <MetricCard label="External false negatives" value={externalGaps.falseNegatives} />
              <MetricCard label="External failure rate" value={`${(externalGaps.falseNegativeRate * 100).toFixed(1)}%`} />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="overflow-x-auto">
                <h3 className="font-bold text-[#26334f]">Top missing properties</h3>
                <table className="mt-3 w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead className="border-b border-[#e0e4e9] text-xs uppercase tracking-[0.08em] text-[#667086]">
                    <tr><th className="px-3 py-3">Property</th><th className="px-3 py-3">Support</th><th className="px-3 py-3">Failures</th><th className="px-3 py-3">Main cause</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7e9ed]">
                    {externalGaps.topMissingProperties.map((property) => (
                      <tr key={property.wikidataProperty} className="align-top">
                        <td className="px-3 py-3"><span className="font-bold text-[#26334f]">{property.wikidataProperty}</span><span className="ml-2 text-[#566176]">{property.propertyLabel}</span></td>
                        <td className="px-3 py-3 text-[#566176]">{property.supportStatus}</td>
                        <td className="px-3 py-3 font-semibold text-[#26334f]">{property.falseNegatives}/{property.tested} ({(property.falseNegativeRate * 100).toFixed(0)}%)</td>
                        <td className="px-3 py-3 text-[#566176]">{property.dominantFailureCause ?? "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <h3 className="font-bold text-[#26334f]">Weak relationship families</h3>
                <table className="mt-3 w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead className="border-b border-[#e0e4e9] text-xs uppercase tracking-[0.08em] text-[#667086]">
                    <tr><th className="px-3 py-3">Family</th><th className="px-3 py-3">Properties</th><th className="px-3 py-3">Failures</th><th className="px-3 py-3">Main cause</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7e9ed]">
                    {externalGaps.topWeakFamilies.map((family) => (
                      <tr key={family.relationshipFamily} className="align-top">
                        <td className="px-3 py-3 font-bold text-[#26334f]">{family.relationshipFamily}</td>
                        <td className="px-3 py-3 text-xs text-[#758095]">{family.properties.join(", ")}</td>
                        <td className="px-3 py-3 font-semibold text-[#26334f]">{family.falseNegatives}/{family.tested} ({(family.falseNegativeRate * 100).toFixed(0)}%)</td>
                        <td className="px-3 py-3 text-[#566176]">{family.dominantFailureCause ?? "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-bold text-[#26334f]">Recommended semantic backlog</h3>
              <ol className="mt-3 grid gap-3 md:grid-cols-2">
                {externalGaps.topRecommendations.map((item) => (
                  <li key={item.property} className="rounded-xl border border-[#e4e7ec] bg-[#fafaf8] p-4 text-sm">
                    <p className="font-bold text-[#26334f]">{item.rank}. {item.property} {item.propertyLabel}</p>
                    <p className="mt-1 text-[#566176]">{item.rootCause ?? "Unknown cause"}</p>
                    <p className="mt-2 text-xs text-[#758095]">Potential gain {item.expectedCoverageGain} · Complexity {item.complexity} · Hub risk {item.hubPollutionRisk}</p>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-[#667086]">No completed external scan is available yet. Run <code className="rounded bg-[#f1f2f4] px-1.5 py-0.5">npm run benchmark:gaps -- --mode=external</code>.</p>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-[#e0e4e9] bg-white/90 p-5">
          <h2 className="text-lg font-bold text-[#17233f]">Negative reasons</h2>
          <ol className="mt-4 space-y-3">
            {data.negativeReasons.map((item) => (
              <li key={item.reason} className="flex items-center justify-between gap-4 text-sm">
                <Link
                  href={filterHref("negative", item.reason)}
                  className="rounded text-[#48546a] underline decoration-[#cfd4dc] underline-offset-4 hover:text-[#b6442c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
                >
                  {item.label}
                </Link>
                <span className="min-w-9 rounded-full bg-[#f2f3f5] px-2.5 py-1 text-center font-bold text-[#26334f]">
                  {item.count}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-[#e0e4e9] bg-white/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#17233f]">Recent feedback</h2>
            <nav aria-label="Feedback filters" className="flex flex-wrap gap-2">
              {filters.map((item) => {
                const active = filter === item.value && (item.value !== "negative" || reason === null);
                return (
                  <Link
                    key={item.value}
                    href={filterHref(item.value)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846] ${
                      active
                        ? "bg-[#17233f] text-white"
                        : "border border-[#d8dde5] bg-white text-[#566176] hover:border-[#ff6846]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          {reason ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#667086]">
              Reason: <span className="font-bold text-[#26334f]">{PATH_FEEDBACK_REASON_LABELS[reason]}</span>
              <Link href={filterHref("negative")} className="underline underline-offset-2 hover:text-[#b6442c]">
                Clear
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e0e4e9] bg-white/90">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-[#f1f2f4] text-xs uppercase tracking-[0.08em] text-[#667086]">
              <tr>
                <th className="px-4 py-3 font-bold">Timestamp</th>
                <th className="px-4 py-3 font-bold">From</th>
                <th className="px-4 py-3 font-bold">To</th>
                <th className="px-4 py-3 font-bold">Rating</th>
                <th className="px-4 py-3 font-bold">Reason</th>
                <th className="px-4 py-3 text-right font-bold">Steps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e9ed]">
              {data.recent.map((entry) => (
                <tr key={entry.id || `${entry.timestamp}-${entry.fromQid}-${entry.toQid}`} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-[#667086]">{formatTimestamp(entry.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-[#26334f]">{entityLabel(entry.fromName, entry.fromQid)}</td>
                  <td className="px-4 py-3 font-medium text-[#26334f]">
                    <a
                      href={`/connect/${encodeURIComponent(entry.fromQid)}/${encodeURIComponent(entry.toQid)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${entry.fromQid} to ${entry.toQid} connection in a new tab`}
                      className="rounded underline decoration-[#cfd4dc] underline-offset-4 hover:text-[#b6442c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
                    >
                      {entityLabel(entry.toName, entry.toQid)} ↗
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${entry.rating === "yes" ? "bg-[#e3f4ed] text-[#27765f]" : "bg-[#fff0eb] text-[#a84631]"}`}>
                      {entry.rating === "yes" ? "Yes" : "Not really"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#566176]">
                    {entry.reason ? PATH_FEEDBACK_REASON_LABELS[entry.reason] : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#26334f]">{entry.pathSteps}</td>
                </tr>
              ))}
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#758095]">
                    No feedback matches this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-4 text-xs text-[#818999]">Showing the latest 50 matching submissions.</p>
    </div>
  );
}

async function AdminContent({ searchParams }: AdminPageProps) {
  await connection();
  const authenticated = await isCurrentAdminAuthenticated();
  const params = await searchParams;

  if (!authenticated) {
    const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
    return <LoginForm error={rawError} />;
  }

  const filter = parseAdminFeedbackFilter(params.filter);
  const reason = filter === "negative" ? parseAdminFeedbackReason(params.reason) : null;

  const [data, gaps, externalGaps] = await Promise.all([
    loadAdminDashboard(filter, reason),
    getLatestCoverageGapSummary(),
    getLatestExternalCoverageGapSummary(),
  ]);
  if (!data) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-[#ead7cf] bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-[#17233f]">Feedback is unavailable</h1>
        <p className="mt-2 text-sm text-[#667086]">The dashboard could not read Neo4j. Please try again shortly.</p>
      </section>
    );
  }

  return <Dashboard data={data} gaps={gaps} externalGaps={externalGaps} filter={filter} reason={reason} />;
}

async function loadAdminDashboard(
  filter: AdminFeedbackFilter,
  reason: PathFeedbackReason | null,
): Promise<AdminFeedbackDashboard | null> {
  try {
    return await getAdminFeedbackDashboard(filter, reason);
  } catch (error: unknown) {
    console.error("Admin dashboard query failed", error);
    return null;
  }
}

function AdminLoading() {
  return (
    <div className="mx-auto rounded-full border border-[#e0e4e9] bg-white/80 px-5 py-3 text-sm font-semibold text-[#667086]">
      Loading admin dashboard…
    </div>
  );
}

export default function AdminPage({ searchParams }: AdminPageProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_10%,rgba(255,190,130,0.2),transparent_26%),linear-gradient(180deg,#fbfaf6_0%,#f3f2ee_100%)] px-4 py-8 text-[#15213b] sm:px-7 lg:px-10">
      <Suspense fallback={<AdminLoading />}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
