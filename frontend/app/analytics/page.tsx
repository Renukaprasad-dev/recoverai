"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ============================================================
   TYPES
============================================================ */

type Activity = {
  campaign_id: number;
  transaction_id: number;
  payment_id: string;
  customer: string;
  amount: number;
  currency: string;
  failure_reason: string;
  strategy: string;
  status: string;
  requires_human_approval: boolean;
  confidence: number | null;
  created_at: string | null;
};

type AnalyticsData = {
  total_failed_payments: number;
  failed_payment_value: number;

  total_recovery_campaigns: number;

  pending_human_reviews: number;
  human_approved: number;
  human_rejected: number;

  successful_recoveries: number;
  failed_recoveries: number;

  recovered_revenue: number | null;
  recovery_rate: number | null;
  human_review_rate: number | null;

  recent_activity: Activity[];
};

type PerformancePoint = {
  index: number;
  campaignId: number;
  transactionId: number;
  amount: number;
  cumulative: number;
  customer: string;
  date: string | null;
};

type StrategyEntry = {
  strategy: string;
  count: number;
};

/* ============================================================
   FORMATTERS
============================================================ */

function formatCurrency(
  value: number | null | undefined,
  currency = "INR"
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatCompactCurrency(value: number) {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(0)}K`;
  }

  return `₹${Math.round(value)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pretty(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ============================================================
   STATUS HELPERS
============================================================ */

function isSuccessfulStatus(status: string) {
  return (
    status === "recovered" ||
    status === "executed_success"
  );
}

function isFailedStatus(status: string) {
  return (
    status === "failed" ||
    status === "recovery_failed" ||
    status === "executed_failed"
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "recovered":
    case "executed_success":
      return "Recovered";

    case "rejected":
      return "Rejected";

    case "planned":
      return "Planned";

    case "pending_human_review":
      return "Pending Review";

    case "failed":
    case "recovery_failed":
    case "executed_failed":
      return "Failed";

    default:
      return pretty(status);
  }
}

function statusClass(status: string) {
  if (isSuccessfulStatus(status)) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (
    status === "rejected" ||
    isFailedStatus(status)
  ) {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (status === "pending_human_review") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (status === "planned") {
    return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  }

  return "border-slate-700 bg-slate-800 text-slate-300";
}

/* ============================================================
   MAIN PAGE
============================================================ */

export default function AnalyticsPage() {
  const [data, setData] =
    useState<AnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* ============================================================
     LOAD ANALYTICS
  ============================================================ */

  const loadAnalytics = useCallback(async () => {
    try {
      setRefreshing(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/v1/analytics/overview`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Analytics request failed: ${response.status}`
        );
      }

      const result: AnalyticsData =
        await response.json();

      setData(result);
    } catch (err) {
      console.error("Analytics error:", err);

      setError(
        "Unable to connect to RecoverAI backend. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* ============================================================
     INITIAL LOAD
  ============================================================ */

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  /* ============================================================
     RECOVERY PERFORMANCE DATA
  ============================================================ */

  const performanceData = useMemo<
    PerformancePoint[]
  >(() => {
    if (!data) {
      return [];
    }

    const successfulActivities =
      [...data.recent_activity]
        .filter((item) =>
          isSuccessfulStatus(item.status)
        )
        .sort((a, b) => {
          const first = a.created_at
            ? new Date(a.created_at).getTime()
            : 0;

          const second = b.created_at
            ? new Date(b.created_at).getTime()
            : 0;

          return first - second;
        });

    let cumulative = 0;

    return successfulActivities.map(
      (item, index) => {
        const amount = Number(item.amount || 0);

        cumulative += amount;

        return {
          index: index + 1,
          campaignId: item.campaign_id,
          transactionId: item.transaction_id,
          amount,
          cumulative,
          customer: item.customer,
          date: item.created_at,
        };
      }
    );
  }, [data]);

  /* ============================================================
     STRATEGY BREAKDOWN
  ============================================================ */

  const strategyBreakdown =
    useMemo<StrategyEntry[]>(() => {
      if (!data) {
        return [];
      }

      const counts: Record<string, number> = {};

      data.recent_activity.forEach((item) => {
        const strategy =
          item.strategy || "unknown";

        counts[strategy] =
          (counts[strategy] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([strategy, count]) => ({
          strategy,
          count,
        }))
        .sort((a, b) => b.count - a.count);
    }, [data]);

  const maxStrategyCount = Math.max(
    ...strategyBreakdown.map(
      (item) => item.count
    ),
    1
  );

  /* ============================================================
     OUTCOME PERCENTAGES
  ============================================================ */

  const totalDecisions =
    (data?.successful_recoveries ?? 0) +
    (data?.failed_recoveries ?? 0) +
    (data?.pending_human_reviews ?? 0);

  const successPercentage =
    totalDecisions > 0
      ? Math.round(
          ((data?.successful_recoveries ?? 0) /
            totalDecisions) *
            100
        )
      : 0;

  const failedPercentage =
    totalDecisions > 0
      ? Math.round(
          ((data?.failed_recoveries ?? 0) /
            totalDecisions) *
            100
        )
      : 0;

  const pendingPercentage =
    totalDecisions > 0
      ? Math.round(
          ((data?.pending_human_reviews ?? 0) /
            totalDecisions) *
            100
        )
      : 0;

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <section className="min-h-screen bg-[#020617] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="animate-pulse">
            <div className="h-3 w-28 rounded bg-slate-800" />

            <div className="mt-5 h-10 w-64 rounded bg-slate-800" />

            <div className="mt-3 h-4 w-[520px] max-w-full rounded bg-slate-800" />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-32 rounded-2xl border border-slate-800 bg-slate-900"
                  />
                )
              )}
            </div>

            <div className="mt-5 h-[380px] rounded-2xl border border-slate-800 bg-slate-900" />

            <div className="mt-5 h-[250px] rounded-2xl border border-slate-800 bg-slate-900" />

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="h-80 rounded-2xl border border-slate-800 bg-slate-900" />

              <div className="h-80 rounded-2xl border border-slate-800 bg-slate-900" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (error || !data) {
    return (
      <section className="min-h-screen bg-[#020617] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-7">
            <p className="text-sm font-semibold text-red-300">
              Analytics unavailable
            </p>

            <p className="mt-2 text-sm text-red-400">
              {error ||
                "No analytics data was returned by the backend."}
            </p>

            <button
              onClick={loadAnalytics}
              disabled={refreshing}
              className="mt-5 rounded-xl border border-red-800 bg-red-950 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing
                ? "Retrying..."
                : "Try again"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ============================================================
     PAGE
  ============================================================ */

  return (
    <section className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col gap-5 border-b border-slate-800/70 pb-7 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
              RecoverAI / Intelligence
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Revenue Analytics
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Measure recovery performance, revenue impact,
              AI decisions, and human governance.
            </p>
          </div>

          <button
            onClick={loadAnalytics}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-800 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            >
              ↻
            </span>

            {refreshing
              ? "Refreshing..."
              : "Refresh data"}
          </button>
        </div>

        {/* =====================================================
            TOP KPI GRID
        ===================================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <AnalyticsCard
            label="Recovered Revenue"
            value={formatCurrency(
              data.recovered_revenue
            )}
            description="Revenue recovered from successful recovery executions"
            accent="green"
          />

          <AnalyticsCard
            label="Recovery Rate"
            value={`${data.recovery_rate ?? 0}%`}
            description="Successful recoveries ÷ total failed payments"
            accent="cyan"
          />

          <AnalyticsCard
            label="Failed Payment Value"
            value={formatCurrency(
              data.failed_payment_value
            )}
            description={`${data.total_failed_payments} failed payment attempts recorded`}
            accent="white"
          />

          <AnalyticsCard
            label="Successful Recoveries"
            value={data.successful_recoveries}
            description="Recovery executions completed successfully"
            accent="green"
          />

        </div>

        {/* =====================================================
            SECONDARY KPI STRIP
        ===================================================== */}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <MiniMetric
            label="Recovery Campaigns"
            value={data.total_recovery_campaigns}
          />

          <MiniMetric
            label="Pending Human Review"
            value={data.pending_human_reviews}
            warning
          />

          <MiniMetric
            label="Human Approved"
            value={data.human_approved}
            positive
          />

          <MiniMetric
            label="Human Rejected"
            value={data.human_rejected}
            danger
          />

        </div>

        {/* =====================================================
            RECOVERY PERFORMANCE
        ===================================================== */}

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70">

          <div className="flex flex-col gap-2 border-b border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recovery Performance
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Revenue recovered from failed payments
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Cumulative recovered revenue across successful executions in the latest activity window returned by the API.
              </p>
            </div>

            <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300">
              {performanceData.length}{" "}
              successful executions
            </div>

          </div>

          <div className="p-6">

            {performanceData.length === 0 ? (

              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30">

                <div className="text-center">

                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                    —
                  </div>

                  <p className="mt-3 text-sm font-medium text-slate-400">
                    No successful recoveries yet
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Recovery performance will appear here after successful execution.
                  </p>

                </div>

              </div>

            ) : (

              <RecoveryPerformanceChart
                points={performanceData}
              />

            )}

          </div>
        </div>

        {/* =====================================================
            RECOVERY PIPELINE
        ===================================================== */}

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70">

          <div className="flex flex-col gap-2 border-b border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recovery Pipeline
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Failed payment → recovery → outcome
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Current recovery flow across the RecoverAI system.
              </p>
            </div>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              {successPercentage}% successful
            </div>

          </div>

          <div className="grid gap-0 md:grid-cols-3">

            <PipelineStep
              number="01"
              label="Failed Payments"
              value={data.total_failed_payments}
              detail={formatCurrency(
                data.failed_payment_value
              )}
              description="Transactions requiring recovery"
            />

            <PipelineStep
              number="02"
              label="Recovery Campaigns"
              value={data.total_recovery_campaigns}
              detail={`${data.human_review_rate ?? 0}% human review`}
              description="AI-generated recovery decisions"
            />

            <PipelineStep
              number="03"
              label="Recovered"
              value={data.successful_recoveries}
              detail={formatCurrency(
                data.recovered_revenue
              )}
              description="Successful recovery executions"
              positive
            />

          </div>
        </div>

        {/* =====================================================
            PERFORMANCE GRID
        ===================================================== */}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">

          {/* =================================================
              OUTCOMES
          ================================================= */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recovery Outcomes
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                  Campaign performance
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Current recovery execution outcomes.
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-right">

                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  Total
                </p>

                <p className="mt-0.5 text-sm font-semibold text-white">
                  {data.total_recovery_campaigns}
                </p>

              </div>

            </div>

            <div className="mt-7 space-y-6">

              <OutcomeRow
                label="Successful"
                value={data.successful_recoveries}
                percentage={successPercentage}
                positive
              />

              <OutcomeRow
                label="Failed"
                value={data.failed_recoveries}
                percentage={failedPercentage}
              />

              <OutcomeRow
                label="Pending Review"
                value={data.pending_human_reviews}
                percentage={pendingPercentage}
                warning
              />

            </div>

          </div>

          {/* =================================================
              STRATEGY MIX
          ================================================= */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                AI Strategy Mix
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Recovery strategies
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Strategy distribution across the latest recovery activity returned by the API.
              </p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600">
                Scope: latest {data.recent_activity.length} activities
              </p>
            </div>

            <div className="mt-7 space-y-6">

              {strategyBreakdown.length === 0 ? (

                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">

                  <p className="text-sm text-slate-500">
                    No strategy data available.
                  </p>

                </div>

              ) : (

                strategyBreakdown.map(
                  ({ strategy, count }) => {

                    const percentage =
                      Math.round(
                        (count /
                          maxStrategyCount) *
                          100
                      );

                    return (
                      <div key={strategy}>

                        <div className="flex items-center justify-between">

                          <div className="flex items-center gap-3">

                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/10 bg-cyan-500/10 text-xs text-cyan-300">
                              AI
                            </div>

                            <span className="text-sm font-medium text-slate-300">
                              {pretty(strategy)}
                            </span>

                          </div>

                          <span className="text-sm font-semibold text-white">
                            {count}
                          </span>

                        </div>

                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">

                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />

                        </div>

                      </div>
                    );
                  }
                )

              )}

            </div>

          </div>

        </div>

        {/* =====================================================
            GOVERNANCE
        ===================================================== */}

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-sm text-violet-300">
                  ◆
                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Human Governance
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-white">
                    AI decisions remain reviewable
                  </h2>

                </div>

              </div>

              <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-500">
                RecoverAI routes decisions requiring oversight through the human review layer before execution.
              </p>

            </div>

            <div className="grid grid-cols-3 gap-3">

              <GovernanceMetric
                label="Approved"
                value={data.human_approved}
                type="approved"
              />

              <GovernanceMetric
                label="Rejected"
                value={data.human_rejected}
                type="rejected"
              />

              <GovernanceMetric
                label="Pending"
                value={data.pending_human_reviews}
                type="pending"
              />

            </div>

          </div>

        </div>

        {/* =====================================================
            RECENT ACTIVITY
        ===================================================== */}

        <div className="mt-8">

          <div className="mb-4 flex items-end justify-between">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Activity
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Recent recovery activity
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest AI decisions and recovery outcomes returned by the API.
              </p>

            </div>

            <div className="hidden rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] text-slate-500 sm:block">
              {data.recent_activity.length}{" "}
              events
            </div>

          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px]">

                <thead>

                  <tr className="border-b border-slate-800 bg-slate-950/70 text-left">

                    <TableHeader>
                      Customer
                    </TableHeader>

                    <TableHeader>
                      Amount
                    </TableHeader>

                    <TableHeader>
                      Failure
                    </TableHeader>

                    <TableHeader>
                      Strategy
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>

                    <TableHeader>
                      Confidence
                    </TableHeader>

                    <TableHeader>
                      Time
                    </TableHeader>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-800">

                  {data.recent_activity.length ===
                  0 ? (

                    <tr>

                      <td
                        colSpan={7}
                        className="px-6 py-16 text-center"
                      >

                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                          —
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-400">
                          No recovery activity yet
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          New recovery campaigns will appear here.
                        </p>

                      </td>

                    </tr>

                  ) : (

                    data.recent_activity.map(
                      (activity) => (

                        <tr
                          key={`${activity.campaign_id}-${activity.transaction_id}`}
                          className="transition hover:bg-slate-800/30"
                        >

                          {/* CUSTOMER */}

                          <td className="px-5 py-4">

                            <p className="text-sm font-medium text-slate-200">
                              {activity.customer}
                            </p>

                            <p className="mt-1 font-mono text-[9px] text-slate-600">
                              {activity.payment_id}
                            </p>

                          </td>

                          {/* AMOUNT */}

                          <td className="px-5 py-4">

                            <p className="text-sm font-semibold text-white">
                              {formatCurrency(
                                activity.amount,
                                activity.currency
                              )}
                            </p>

                            <p className="mt-1 text-[9px] uppercase text-slate-600">
                              {activity.currency}
                            </p>

                          </td>

                          {/* FAILURE */}

                          <td className="px-5 py-4">

                            <span className="inline-flex rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-400">
                              {pretty(
                                activity.failure_reason
                              )}
                            </span>

                          </td>

                          {/* STRATEGY */}

                          <td className="px-5 py-4">

                            <span className="inline-flex rounded-lg border border-cyan-500/10 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
                              {pretty(
                                activity.strategy
                              )}
                            </span>

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${statusClass(
                                activity.status
                              )}`}
                            >
                              {statusLabel(
                                activity.status
                              )}
                            </span>

                          </td>

                          {/* CONFIDENCE */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">

                                <div
                                  className="h-full rounded-full bg-cyan-400"
                                  style={{
                                    width: `${
                                      Math.min(
                                        Math.max(
                                          Number(
                                            activity.confidence ??
                                              0
                                          ) * 100,
                                          0
                                        ),
                                        100
                                      )
                                    }%`,
                                  }}
                                />

                              </div>

                              <span className="text-[10px] text-slate-400">
                                {Math.round(
                                  Number(
                                    activity.confidence ??
                                      0
                                  ) * 100
                                )}
                                %
                              </span>

                            </div>

                          </td>

                          {/* TIME */}

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(
                              activity.created_at
                            )}
                          </td>

                        </tr>

                      )
                    )

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

        {/* =====================================================
            FOOTER
        ===================================================== */}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-800/70 pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            Analytics synchronized with RecoverAI API

          </div>

          <div>
            {data.total_recovery_campaigns}{" "}
            recovery campaigns analyzed
          </div>

        </div>

      </div>
    </section>
  );
}

/* ============================================================
   RECOVERY PERFORMANCE CHART
============================================================ */

function RecoveryPerformanceChart({
  points,
}: {
  points: PerformancePoint[];
}) {
  const width = 900;
  const height = 320;

  const paddingLeft = 75;
  const paddingRight = 30;
  const paddingTop = 35;
  const paddingBottom = 50;

  const chartWidth =
    width -
    paddingLeft -
    paddingRight;

  const chartHeight =
    height -
    paddingTop -
    paddingBottom;

  const maxValue = Math.max(
    ...points.map(
      (point) => point.cumulative
    ),
    1
  );

  const getX = (index: number) => {
    if (points.length === 1) {
      return (
        paddingLeft +
        chartWidth / 2
      );
    }

    return (
      paddingLeft +
      (index /
        (points.length - 1)) *
        chartWidth
    );
  };

  const getY = (value: number) => {
    return (
      paddingTop +
      chartHeight -
      (value / maxValue) *
        chartHeight
    );
  };

  const coordinates = points.map(
    (point, index) => ({
      ...point,
      x: getX(index),
      y: getY(point.cumulative),
    })
  );

  const linePoints = coordinates
    .map(
      (point) =>
        `${point.x},${point.y}`
    )
    .join(" ");

  const areaPoints = [
    `${paddingLeft},${
      paddingTop + chartHeight
    }`,
    ...coordinates.map(
      (point) =>
        `${point.x},${point.y}`
    ),
    `${
      paddingLeft + chartWidth
    },${
      paddingTop + chartHeight
    }`,
  ].join(" ");

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="w-full">

      <div className="overflow-x-auto">

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[320px] w-full min-w-[650px]"
          role="img"
          aria-label="Cumulative recovery performance chart"
        >

          {/* GRID */}

          {gridLines.map(
            (percentage) => {

              const value =
                (maxValue *
                  percentage) /
                100;

              const y =
                paddingTop +
                chartHeight -
                (percentage / 100) *
                  chartHeight;

              return (
                <g
                  key={percentage}
                >

                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={
                      paddingLeft +
                      chartWidth
                    }
                    y2={y}
                    stroke="rgb(30 41 59)"
                    strokeWidth="1"
                  />

                  <text
                    x={
                      paddingLeft - 12
                    }
                    y={y + 4}
                    textAnchor="end"
                    fill="rgb(100 116 139)"
                    fontSize="10"
                  >
                    {formatCompactCurrency(
                      value
                    )}
                  </text>

                </g>
              );
            }
          )}

          {/* AREA */}

          <polygon
            points={areaPoints}
            fill="rgb(6 182 212)"
            fillOpacity="0.06"
          />

          {/* LINE */}

          {coordinates.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="rgb(34 211 238)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* POINTS */}

          {coordinates.map(
            (point) => (
              <g
                key={`${point.campaignId}-${point.transactionId}`}
              >

                <circle
                  cx={point.x}
                  cy={point.y}
                  r="7"
                  fill="rgb(8 47 73)"
                  stroke="rgb(34 211 238)"
                  strokeWidth="2"
                />

                <circle
                  cx={point.x}
                  cy={point.y}
                  r="2.5"
                  fill="rgb(103 232 249)"
                />

                <text
                  x={point.x}
                  y={point.y - 14}
                  textAnchor="middle"
                  fill="rgb(226 232 240)"
                  fontSize="10"
                  fontWeight="600"
                >
                  {formatCompactCurrency(
                    point.cumulative
                  )}
                </text>

              </g>
            )
          )}

          {/* X AXIS */}

          {coordinates.map(
            (point, index) => {

              if (
                coordinates.length > 6 &&
                index !== 0 &&
                index !==
                  coordinates.length -
                    1
              ) {
                return null;
              }

              return (
                <text
                  key={`label-${point.campaignId}-${point.transactionId}`}
                  x={point.x}
                  y={height - 15}
                  textAnchor="middle"
                  fill="rgb(100 116 139)"
                  fontSize="10"
                >
                  Recovery {point.index}
                </text>
              );
            }
          )}

        </svg>

      </div>

      {/* CHART SUMMARY */}

      <div className="mt-2 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-2">

          <span className="h-2 w-2 rounded-full bg-cyan-400" />

          <span className="text-xs text-slate-500">
            Cumulative recovered revenue
          </span>

        </div>

        <div className="flex items-center gap-5">

          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-600">
              Latest
            </p>

            <p className="mt-1 text-sm font-semibold text-cyan-300">
              {formatCurrency(
                points[
                  points.length - 1
                ].cumulative
              )}
            </p>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-600">
              Executions
            </p>

            <p className="mt-1 text-sm font-semibold text-white">
              {points.length}
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   ANALYTICS CARD
============================================================ */

function AnalyticsCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  accent: "green" | "cyan" | "white";
}) {
  const valueClass =
    accent === "green"
      ? "text-emerald-300"
      : accent === "cyan"
        ? "text-cyan-300"
        : "text-white";

  const dotClass =
    accent === "green"
      ? "bg-emerald-400"
      : accent === "cyan"
        ? "bg-cyan-400"
        : "bg-slate-600";

  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900">

      <div className="flex items-start justify-between">

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <span
          className={`h-2 w-2 rounded-full ${dotClass}`}
        />

      </div>

      <p
        className={`mt-4 text-2xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-slate-600">
        {description}
      </p>

    </div>
  );
}

/* ============================================================
   MINI METRIC
============================================================ */

function MiniMetric({
  label,
  value,
  positive = false,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  let valueClass = "text-white";

  if (positive) {
    valueClass = "text-emerald-300";
  }

  if (warning) {
    valueClass = "text-amber-300";
  }

  if (danger) {
    valueClass = "text-red-300";
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">

      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-semibold ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   PIPELINE STEP
============================================================ */

function PipelineStep({
  number,
  label,
  value,
  detail,
  description,
  positive = false,
}: {
  number: string;
  label: string;
  value: number;
  detail: string;
  description: string;
  positive?: boolean;
}) {
  return (
    <div className="relative border-b border-slate-800 p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">

      <div className="flex items-center justify-between">

        <span className="text-[10px] font-semibold tracking-[0.18em] text-slate-600">
          {number}
        </span>

        {positive && (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase text-emerald-300">
            Success
          </span>
        )}

      </div>

      <p className="mt-5 text-xs font-medium text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-semibold ${
          positive
            ? "text-emerald-300"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm font-medium text-slate-300">
        {detail}
      </p>

      <p className="mt-1 text-[10px] leading-5 text-slate-600">
        {description}
      </p>

    </div>
  );
}

/* ============================================================
   OUTCOME ROW
============================================================ */

function OutcomeRow({
  label,
  value,
  percentage,
  positive = false,
  warning = false,
}: {
  label: string;
  value: number;
  percentage: number;
  positive?: boolean;
  warning?: boolean;
}) {
  const dotClass =
    positive
      ? "bg-emerald-400"
      : warning
        ? "bg-amber-400"
        : "bg-slate-600";

  const barClass =
    positive
      ? "bg-emerald-400"
      : warning
        ? "bg-amber-400"
        : "bg-slate-600";

  return (
    <div>

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <span
            className={`h-2 w-2 rounded-full ${dotClass}`}
          />

          <span className="text-sm text-slate-300">
            {label}
          </span>

        </div>

        <div className="flex items-center gap-3">

          <span className="text-sm font-semibold text-white">
            {value}
          </span>

          <span className="w-10 text-right text-[10px] text-slate-600">
            {percentage}%
          </span>

        </div>

      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">

        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{
            width: `${Math.min(
              Math.max(
                percentage,
                0
              ),
              100
            )}%`,
          }}
        />

      </div>

    </div>
  );
}

/* ============================================================
   GOVERNANCE METRIC
============================================================ */

function GovernanceMetric({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "approved" | "rejected" | "pending";
}) {
  const valueClass =
    type === "approved"
      ? "text-emerald-300"
      : type === "rejected"
        ? "text-red-300"
        : "text-amber-300";

  return (
    <div className="min-w-[90px] rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">

      <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-semibold ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   TABLE HEADER
============================================================ */

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
      {children}
    </th>
  );
}