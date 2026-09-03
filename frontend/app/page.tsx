"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_CONNECTION_ERROR, API_URL } from "../lib/api";
type Activity = {
  campaign_id: number;
  transaction_id: number;
  payment_id: string;
  customer: string;
  amount: number;
  currency: string;
  failure_reason: string;
  payment_method?: string;
  strategy: string;
  status: string;
  requires_human_approval: boolean;
  confidence: number;
  created_at: string;
};

type AnalyticsData = {
  total_failed_payments: number;
  failed_payment_value: number;
  total_recovery_campaigns: number;
  pending_human_reviews: number;
  automatic_recoveries?: number;
  human_approved: number;
  human_rejected: number;
  successful_recoveries: number;
  failed_recoveries: number;
  blocked_decisions?: number;
  human_review_rate: number;
  recovered_revenue: number | null;
  recovery_rate: number | null;
  recent_activity: Activity[];
};

type HealthData = {
  status: string;
  database?: string;
};

type ChartPoint = {
  date: string;
  label: string;
  recovered: number;
  failed: number;
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatShortCurrency(value: number) {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(value)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChartDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status: string) {
  switch (status) {
    case "executed_success":
      return "Recovered";

    case "recovered":
      return "Recovered";

    case "rejected":
      return "Rejected";

    case "planned":
      return "Planned";

    case "pending_human_review":
      return "Pending Review";

    case "executed_failed":
      return "Failed";

    case "failed":
      return "Failed";

    default:
      return pretty(status);
  }
}

function statusClass(status: string) {
  if (
    status === "executed_success" ||
    status === "recovered"
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (status === "pending_human_review") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (
    status === "executed_failed" ||
    status === "failed"
  ) {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border-slate-700 bg-slate-800 text-slate-300";
}

function isRecovered(status: string) {
  return (
    status === "executed_success" ||
    status === "recovered"
  );
}

function isFailed(status: string) {
  return (
    status === "failed" ||
    status === "executed_failed" ||
    status === "rejected"
  );
}

function getDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function Home() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      setError("");

      const [analyticsResponse, healthResponse] =
        await Promise.all([
          fetch(
            `${API_URL}/api/v1/analytics/overview`,
            {
              cache: "no-store",
            }
          ),

          fetch(`${API_URL}/health`, {
            cache: "no-store",
          }),
        ]);

      if (!analyticsResponse.ok) {
        throw new Error(
          `Analytics request failed: ${analyticsResponse.status}`
        );
      }

      const analyticsResult: AnalyticsData =
        await analyticsResponse.json();

      setData(analyticsResult);

      if (healthResponse.ok) {
        const healthResult: HealthData =
          await healthResponse.json();

        setHealth(healthResult);
      } else {
        setHealth(null);
      }
    } catch (err) {
      console.error(err);

      setError(
        API_CONNECTION_ERROR
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /*
   * ============================================================
   * RECOVERY PERFORMANCE CHART
   * ============================================================
   *
   * We create a 7-day timeline.
   *
   * Every day is shown, even if there was no activity.
   *
   * Recovered:
   * - executed_success
   * - recovered
   *
   * Failed:
   * - failed
   * - executed_failed
   * - rejected
   */

  const chartData = useMemo<ChartPoint[]>(() => {
    const today = new Date();

    const grouped: Record<
      string,
      {
        recovered: number;
        failed: number;
      }
    > = {};

    /*
     * Create the previous 6 days + today.
     */
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);

      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - i);

      const key = getDateKey(date);

      grouped[key] = {
        recovered: 0,
        failed: 0,
      };
    }

    /*
     * Add real transaction activity.
     */
    data?.recent_activity?.forEach((activity) => {
      const activityDate = new Date(activity.created_at);
      const key = getDateKey(activityDate);

      /*
       * Only include activity from the displayed
       * 7-day window.
       */
      if (!grouped[key]) {
        return;
      }

      if (isRecovered(activity.status)) {
        grouped[key].recovered += activity.amount;
      }

      if (isFailed(activity.status)) {
        grouped[key].failed += activity.amount;
      }
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        label: formatChartDate(date),
        recovered: values.recovered,
        failed: values.failed,
      }));
  }, [data]);

  /*
   * ============================================================
   * CHART MAX
   * ============================================================
   */

  const chartMax = useMemo(() => {
    const maximum = Math.max(
      ...chartData.flatMap((point) => [
        point.recovered,
        point.failed,
      ]),
      1
    );

    /*
     * Add 15% breathing room above the highest bar.
     */
    return maximum * 1.15;
  }, [chartData]);

  /*
   * ============================================================
   * STRATEGY BREAKDOWN
   * ============================================================
   */

  const strategyBreakdown = useMemo(() => {
    if (!data?.recent_activity) {
      return [];
    }

    const counts: Record<string, number> = {};

    data.recent_activity.forEach((activity) => {
      counts[activity.strategy] =
        (counts[activity.strategy] || 0) + 1;
    });

    return Object.entries(counts).sort(
      (a, b) => b[1] - a[1]
    );
  }, [data]);

  const maxStrategyCount = Math.max(
    ...strategyBreakdown.map(([, count]) => count),
    1
  );

  /*
   * ============================================================
   * DASHBOARD CALCULATIONS
   * ============================================================
   */

  const totalCampaigns =
    data?.total_recovery_campaigns ?? 0;

  const retryCount =
    strategyBreakdown.find(
      ([strategy]) => strategy === "retry"
    )?.[1] ?? 0;

  const humanReviewCount =
    strategyBreakdown.find(
      ([strategy]) => strategy === "human_review"
    )?.[1] ?? 0;

  const discountCount =
    strategyBreakdown.find(
      ([strategy]) => strategy === "discount"
    )?.[1] ?? 0;

  const systemOperational =
    health?.status === "healthy" &&
    health?.database === "connected";

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

          <div className="animate-pulse">

            <div className="h-3 w-24 rounded bg-slate-800" />

            <div className="mt-5 h-10 w-72 rounded bg-slate-800" />

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

            <div className="mt-6 grid gap-5 lg:grid-cols-3">

              <div className="h-[500px] rounded-2xl border border-slate-800 bg-slate-900 lg:col-span-2" />

              <div className="h-[500px] rounded-2xl border border-slate-800 bg-slate-900" />

            </div>

          </div>

        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ERROR
   * ============================================================
   */

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#020617] text-white">

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

          <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-7">

            <p className="text-sm font-semibold text-red-300">
              Dashboard unavailable
            </p>

            <p className="mt-2 text-sm text-red-400">
              {error}
            </p>

            <button
              onClick={loadDashboard}
              className="mt-5 rounded-xl border border-red-800 bg-red-950 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-900"
            >
              Try again
            </button>

          </div>

        </div>

      </div>
    );
  }

  /*
   * ============================================================
   * MAIN DASHBOARD
   * ============================================================
   */

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col gap-5 border-b border-slate-800/70 pb-7 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
              Overview
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Revenue Recovery
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Monitor failed payments, recovery performance,
              AI decisions, and human oversight from one
              control center.
            </p>

          </div>

          <button
            onClick={loadDashboard}
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

        {/* ======================================================
            KPI CARDS
        ====================================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <DashboardCard
            label="Recovered Revenue"
            value={formatCurrency(
              data.recovered_revenue
            )}
            description="Successful recovery"
            valueClass="text-emerald-300"
            dotClass="bg-emerald-400"
          />

          <DashboardCard
            label="Revenue at Risk"
            value={formatCurrency(
              data.failed_payment_value
            )}
            description="Failed payment value"
            valueClass="text-white"
            dotClass="bg-slate-600"
          />

          <DashboardCard
            label="Recovery Rate"
            value={`${data.recovery_rate ?? 0}%`}
            description="Successful ÷ failed payments"
            valueClass="text-cyan-300"
            dotClass="bg-cyan-400"
          />

          <DashboardCard
            label="AI Campaigns"
            value={data.total_recovery_campaigns}
            description="Recovery decisions generated"
            valueClass="text-white"
            dotClass="bg-slate-600"
          />

        </div>

        {/* ======================================================
            PERFORMANCE + AI MIX
        ====================================================== */}

        <div className="mt-6 grid gap-5 lg:grid-cols-3">

          {/* ====================================================
              RECOVERY PERFORMANCE
          ==================================================== */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

              <div>

                <h2 className="font-semibold text-white">
                  Recovery Performance
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Recovered and failed payment value over time
                </p>

              </div>

              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                Last 7 days
              </span>

            </div>

            {/* LEGEND */}

            <div className="mt-6 flex items-center gap-5 text-xs">

              <div className="flex items-center gap-2">

                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                <span className="text-slate-400">
                  Recovered
                </span>

              </div>

              <div className="flex items-center gap-2">

                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />

                <span className="text-slate-400">
                  Failed
                </span>

              </div>

            </div>

            {/* ==================================================
                CHART
            ================================================== */}

            {chartData.length === 0 ? (

              <div className="mt-8 flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30">

                <div className="text-center">

                  <p className="text-sm font-medium text-slate-400">
                    No chart data available
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Recovery activity will appear here.
                  </p>

                </div>

              </div>

            ) : (

              <div className="mt-8">

                <div className="relative h-64">

                  {/* Y AXIS */}

                  <div className="pointer-events-none absolute left-0 top-0 flex h-full w-10 flex-col justify-between text-[8px] text-slate-600">

                    <span>
                      {formatShortCurrency(chartMax)}
                    </span>

                    <span>
                      {formatShortCurrency(
                        chartMax * 0.75
                      )}
                    </span>

                    <span>
                      {formatShortCurrency(
                        chartMax * 0.5
                      )}
                    </span>

                    <span>
                      {formatShortCurrency(
                        chartMax * 0.25
                      )}
                    </span>

                    <span>
                      ₹0
                    </span>

                  </div>

                  {/* GRID */}

                  <div className="pointer-events-none absolute inset-0 ml-12 flex flex-col justify-between">

                    {[0, 1, 2, 3, 4].map(
                      (line) => (
                        <div
                          key={line}
                          className="border-t border-slate-800"
                        />
                      )
                    )}

                  </div>

                  {/* BARS */}

                  <div className="absolute inset-0 ml-12 flex items-end justify-between gap-2">

                    {chartData.map((point) => {

                      const recoveredHeight =
                        point.recovered > 0
                          ? Math.max(
                              (point.recovered /
                                chartMax) *
                                100,
                              4
                            )
                          : 0;

                      const failedHeight =
                        point.failed > 0
                          ? Math.max(
                              (point.failed /
                                chartMax) *
                                100,
                              4
                            )
                          : 0;

                      return (
                        <div
                          key={point.date}
                          className="group relative flex h-full flex-1 items-end justify-center gap-1"
                        >

                          {/* TOOLTIP */}

                          <div className="pointer-events-none absolute bottom-[70%] left-1/2 z-30 hidden w-48 -translate-x-1/2 rounded-xl border border-slate-700 bg-[#020617] p-3 shadow-2xl group-hover:block">

                            <p className="text-xs font-semibold text-white">
                              {point.label}
                            </p>

                            <div className="mt-3 space-y-2">

                              <div className="flex items-center justify-between gap-4">

                                <div className="flex items-center gap-2">

                                  <span className="h-2 w-2 rounded-full bg-emerald-400" />

                                  <span className="text-[10px] text-slate-500">
                                    Recovered
                                  </span>

                                </div>

                                <span className="text-[10px] font-semibold text-emerald-300">
                                  {formatCurrency(
                                    point.recovered
                                  )}
                                </span>

                              </div>

                              <div className="flex items-center justify-between gap-4">

                                <div className="flex items-center gap-2">

                                  <span className="h-2 w-2 rounded-full bg-cyan-400" />

                                  <span className="text-[10px] text-slate-500">
                                    Failed
                                  </span>

                                </div>

                                <span className="text-[10px] font-semibold text-cyan-300">
                                  {formatCurrency(
                                    point.failed
                                  )}
                                </span>

                              </div>

                            </div>

                          </div>

                          {/* RECOVERED BAR */}

                          <div
                            className="w-4 rounded-t-md bg-emerald-400/80 transition-all duration-500 group-hover:bg-emerald-300 sm:w-7"
                            style={{
                              height: `${recoveredHeight}%`,
                            }}
                          />

                          {/* FAILED BAR */}

                          <div
                            className="w-4 rounded-t-md bg-cyan-400/70 transition-all duration-500 group-hover:bg-cyan-300 sm:w-7"
                            style={{
                              height: `${failedHeight}%`,
                            }}
                          />

                        </div>
                      );
                    })}

                  </div>

                </div>

                {/* DATE LABELS */}

                <div className="ml-12 mt-3 flex justify-between gap-2">

                  {chartData.map((point) => (
                    <span
                      key={point.date}
                      className="flex-1 text-center text-[9px] text-slate-600"
                    >
                      {point.label}
                    </span>
                  ))}

                </div>

                {/* ==================================================
                    CHART SUMMARY
                ================================================== */}

                <div className="mt-6 grid gap-3 sm:grid-cols-3">

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">

                    <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                      Total Recovered
                    </p>

                    <p className="mt-2 text-lg font-semibold text-emerald-300">
                      {formatCurrency(
                        data.recovered_revenue
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-600">
                      Successfully recovered revenue
                    </p>

                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">

                    <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                      Failed Value
                    </p>

                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatCurrency(
                        data.failed_payment_value
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-600">
                      Payment value requiring recovery
                    </p>

                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">

                    <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                      Recovery Rate
                    </p>

                    <p className="mt-2 text-lg font-semibold text-cyan-300">
                      {data.recovery_rate ?? 0}%
                    </p>

                    <p className="mt-1 text-[10px] text-slate-600">
                      Recovered value ÷ failed value
                    </p>

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* ====================================================
              AI DECISION MIX
          ==================================================== */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">

            <h2 className="font-semibold text-white">
              AI Decision Mix
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Current recovery strategies
            </p>

            <div className="mt-8 space-y-7">

              <StrategyRow
                label="Retry"
                count={retryCount}
                max={maxStrategyCount}
                barClass="bg-cyan-400"
              />

              <StrategyRow
                label="Human Review"
                count={humanReviewCount}
                max={maxStrategyCount}
                barClass="bg-amber-400"
              />

              <StrategyRow
                label="Discount"
                count={discountCount}
                max={maxStrategyCount}
                barClass="bg-violet-400"
              />

            </div>

            <div className="mt-8 border-t border-slate-800 pt-6">

              <div className="flex items-center justify-between">

                <span className="text-xs text-slate-500">
                  Total AI campaigns
                </span>

                <span className="text-sm font-semibold text-white">
                  {totalCampaigns}
                </span>

              </div>

              <div className="mt-4 flex items-center justify-between">

                <span className="text-xs text-slate-500">
                  Human review rate
                </span>

                <span className="text-sm font-semibold text-amber-300">
                  {data.human_review_rate}%
                </span>

              </div>

            </div>

          </div>

        </div>

        {/* ======================================================
            RECENT ACTIVITY
        ====================================================== */}

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80">

          <div className="flex flex-col gap-2 border-b border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Activity
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Recent recovery activity
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest AI decisions and recovery outcomes.
              </p>

            </div>

            <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-[10px] text-slate-500">
              {data.recent_activity.length} events
            </span>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px]">

              <thead>

                <tr className="border-b border-slate-800 bg-slate-950/70 text-left">

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Customer
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Strategy
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Status
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Confidence
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Time
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800">

                {data.recent_activity
                  .slice(0, 8)
                  .map((activity) => (

                    <tr
                      key={activity.campaign_id}
                      className="transition hover:bg-slate-800/30"
                    >

                      <td className="px-5 py-4">

                        <p className="text-sm font-medium text-slate-200">
                          {activity.customer}
                        </p>

                        <p className="mt-1 font-mono text-[9px] text-slate-600">
                          {activity.payment_id}
                        </p>

                      </td>

                      <td className="px-5 py-4">

                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(
                            activity.amount
                          )}
                        </p>

                        <p className="mt-1 text-[9px] uppercase text-slate-600">
                          {activity.currency}
                        </p>

                      </td>

                      <td className="px-5 py-4">

                        <span className="inline-flex rounded-lg border border-cyan-500/10 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
                          {pretty(activity.strategy)}
                        </span>

                      </td>

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

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">

                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{
                                width: `${Math.min(
                                  Math.max(
                                    activity.confidence *
                                      100,
                                    0
                                  ),
                                  100
                                )}%`,
                              }}
                            />

                          </div>

                          <span className="text-[10px] text-slate-400">
                            {Math.round(
                              activity.confidence *
                                100
                            )}
                            %
                          </span>

                        </div>

                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(
                          activity.created_at
                        )}
                      </td>

                    </tr>

                  ))}

              </tbody>

            </table>

          </div>

        </div>

        {/* ======================================================
            SYSTEM STATUS
        ====================================================== */}

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <span
                  className={`h-2 w-2 rounded-full ${
                    systemOperational
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />

                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    systemOperational
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {systemOperational
                    ? "System Operational"
                    : "System Check Required"}
                </span>

              </div>

              <h2 className="mt-2 text-lg font-semibold text-white">

                {systemOperational
                  ? "AI recovery engine is active"
                  : "RecoverAI backend connection needs attention"}

              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Policy guardrails, human oversight,
                recovery execution, and analytics are
                connected.
              </p>

            </div>

            <a
              href="/recovery"
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Open Recovery Queue
            </a>

          </div>

        </div>

        {/* ======================================================
            FOOTER
        ====================================================== */}

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-800/70 pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            Analytics synchronized with RecoverAI API

          </div>

          <div>
            {data.total_recovery_campaigns} recovery campaigns analyzed
          </div>

        </div>

      </section>

    </div>
  );
}


/* ================================================================
   DASHBOARD CARD
================================================================ */

function DashboardCard({
  label,
  value,
  description,
  valueClass,
  dotClass,
}: {
  label: string;
  value: string | number;
  description: string;
  valueClass: string;
  dotClass: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900">

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


/* ================================================================
   STRATEGY ROW
================================================================ */

function StrategyRow({
  label,
  count,
  max,
  barClass,
}: {
  label: string;
  count: number;
  max: number;
  barClass: string;
}) {
  const percentage =
    max > 0
      ? Math.round((count / max) * 100)
      : 0;

  return (
    <div>

      <div className="mb-2 flex items-center justify-between">

        <span className="text-xs text-slate-400">
          {label}
        </span>

        <span className="text-sm font-semibold text-white">
          {count}
        </span>

      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-800">

        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}
