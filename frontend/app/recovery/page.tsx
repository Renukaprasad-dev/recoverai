"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_CONNECTION_ERROR, API_URL } from "../../lib/api";

type RecoveryCase = {
  campaign_id: number;
  transaction_id: number;
  payment_id: string;

  customer: {
    name: string;
    email: string;
    phone?: string | null;
  };

  amount: number;
  currency: string;
  failure_reason: string;
  payment_method: string;

  strategy: string;
  reason: string;

  retry_after_minutes?: number | null;
  discount_percent?: number | null;

  requires_human_approval: boolean;
  confidence?: number | null;

  status: string;
  created_at?: string | null;
};

type PendingResponse = {
  count: number;
  cases: RecoveryCase[];
};

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
  confidence: number;
  created_at: string;
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

type Action = "approve" | "reject" | "execute";

export default function RecoveryPage() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);

  const [analytics, setAnalytics] =
    useState<AnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] =
    useState<number | null>(null);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  /*
   * ============================================================
   * LOAD RECOVERY QUEUE
   * ============================================================
   */

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/v1/recovery/pending`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load recovery queue (${response.status}).`
        );
      }

      const data: PendingResponse =
        await response.json();

      setCases(data.cases || []);

      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);

      setError(
        API_CONNECTION_ERROR
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * ============================================================
   * LOAD ANALYTICS
   * ============================================================
   */

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/v1/analytics/overview`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data: AnalyticsData =
        await response.json();

      setAnalytics(data);
    } catch (err) {
      console.error(
        "Analytics loading failed:",
        err
      );
    }
  }, []);

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    loadCases();
    loadAnalytics();
  }, [loadCases, loadAnalytics]);

  /*
   * ============================================================
   * REFRESH EVERYTHING
   * ============================================================
   */

  const refreshEverything = useCallback(async () => {
    setMessage("");

    await Promise.all([
      loadCases(),
      loadAnalytics(),
    ]);
  }, [loadCases, loadAnalytics]);

  /*
   * ============================================================
   * APPROVE / REJECT / EXECUTE
   * ============================================================
   */

  async function performAction(
    campaignId: number,
    action: Action
  ) {
    try {
      setActionLoading(campaignId);

      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/v1/recovery/${campaignId}/${action}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      let data: any = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            `Unable to ${action} recovery campaign.`
        );
      }

      if (action === "approve") {
        setMessage(
          `Campaign #${campaignId} approved. Recovery authorization recorded successfully.`
        );
      }

      if (action === "reject") {
        setMessage(
          `Campaign #${campaignId} rejected successfully.`
        );
      }

      if (action === "execute") {
        setMessage(
          `Campaign #${campaignId} executed successfully.`
        );
      }

      await refreshEverything();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while processing the recovery."
      );
    } finally {
      setActionLoading(null);
    }
  }

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  function formatCurrency(
    amount: number,
    currency = "INR"
  ) {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `₹${Math.round(
        amount
      ).toLocaleString("en-IN")}`;
    }
  }

  function formatDate(date?: string | null) {
    if (!date) return "—";

    return new Date(date).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function strategyLabel(strategy?: string) {
    if (!strategy) return "Unknown";

    return strategy
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function failureLabel(reason?: string) {
    if (!reason) return "Unknown";

    return reason
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function statusLabel(status?: string) {
    if (!status) return "Unknown";

    switch (status) {
      case "executed_success":
        return "Recovered";

      case "executed_failed":
        return "Recovery Failed";

      case "pending_human_review":
        return "Pending Review";

      case "rejected":
        return "Rejected";

      case "approved":
        return "Approved";

      case "planned":
        return "Planned";

      default:
        return status
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
          );
    }
  }

  function confidenceLabel(
    confidence?: number | null
  ) {
    if (
      confidence === null ||
      confidence === undefined
    ) {
      return "Unknown";
    }

    if (confidence >= 0.9) {
      return "Very High";
    }

    if (confidence >= 0.75) {
      return "High";
    }

    if (confidence >= 0.5) {
      return "Medium";
    }

    return "Low";
  }

  function confidencePercent(
    confidence?: number | null
  ) {
    if (
      confidence === null ||
      confidence === undefined
    ) {
      return 0;
    }

    return Math.min(
      Math.max(Math.round(confidence * 100), 0),
      100
    );
  }

  function retryLabel(
    minutes?: number | null
  ) {
    if (!minutes) return null;

    if (minutes >= 1440) {
      const days = Math.round(
        minutes / 1440
      );

      return `${days} day${
        days === 1 ? "" : "s"
      }`;
    }

    return `${minutes} minutes`;
  }

  /*
   * ============================================================
   * DERIVED DATA
   * ============================================================
   */

  const humanReviewCount = cases.filter(
    (item) =>
      item.requires_human_approval
  ).length;

  const totalRisk = cases.reduce(
    (total, item) =>
      total + Number(item.amount || 0),
    0
  );

  const recentActivities = useMemo(() => {
    return (
      analytics?.recent_activity || []
    ).slice(0, 6);
  }, [analytics]);

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <section className="min-h-screen bg-[#020617] text-white">

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col gap-6 border-b border-slate-800/70 pb-7 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="relative flex h-2 w-2">

                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />

              </span>

              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400">
                Human-in-the-loop
              </p>

            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Recovery Queue
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Review recovery decisions that the
              AI policy engine has intentionally held
              for human approval.
            </p>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">

              <span className="relative flex h-2 w-2">

                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />

              </span>

              <span className="text-xs font-medium text-emerald-300">
                AI Engine Online
              </span>

            </div>

            <button
              onClick={refreshEverything}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-800 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >

              <span
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              >
                ↻
              </span>

              {loading
                ? "Refreshing..."
                : "Refresh Queue"}

            </button>

          </div>

        </div>

        {/* ======================================================
            SYSTEM STATUS STRIP
        ====================================================== */}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">

          <StatusStrip
            icon="AI"
            title="AI Policy Engine"
            value="Operational"
            description="Decision engine active"
            type="green"
          />

          <StatusStrip
            icon="◆"
            title="Human Governance"
            value={
              humanReviewCount > 0
                ? "Attention Required"
                : "Standby"
            }
            description={
              humanReviewCount > 0
                ? `${humanReviewCount} decision${
                    humanReviewCount === 1
                      ? ""
                      : "s"
                  } awaiting review`
                : "No blocked decisions"
            }
            type={
              humanReviewCount > 0
                ? "amber"
                : "cyan"
            }
          />

          <StatusStrip
            icon="↻"
            title="Last Synchronization"
            value={
              lastUpdated
                ? lastUpdated.toLocaleTimeString(
                    "en-IN",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                : "Synchronizing"
            }
            description="Connected to RecoverAI API"
            type="cyan"
          />

        </div>

        {/* ======================================================
            ALERTS
        ====================================================== */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 px-5 py-4">

            <div className="flex gap-3">

              <span className="text-red-400">
                !
              </span>

              <div>

                <p className="text-sm font-semibold text-red-300">
                  Recovery queue error
                </p>

                <p className="mt-1 text-xs leading-5 text-red-400/80">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-5 py-4">

            <div className="flex gap-3">

              <span className="text-emerald-400">
                ✓
              </span>

              <div>

                <p className="text-sm font-semibold text-emerald-300">
                  Recovery action completed
                </p>

                <p className="mt-1 text-xs leading-5 text-emerald-400/80">
                  {message}
                </p>

              </div>

            </div>

          </div>
        )}

        {/* ======================================================
            SUMMARY
        ====================================================== */}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            label="Pending Reviews"
            value={cases.length}
            description="Decisions awaiting human review"
            icon="!"
            type="amber"
          />

          <SummaryCard
            label="Requires Human"
            value={humanReviewCount}
            description="Cases blocked from automation"
            icon="◆"
            type="amber"
          />

          <SummaryCard
            label="At-Risk Value"
            value={formatCurrency(
              totalRisk,
              "INR"
            )}
            description="Payment value currently in queue"
            icon="₹"
            type="cyan"
          />

          <SummaryCard
            label="Recovered Revenue"
            value={formatCurrency(
              analytics?.recovered_revenue ?? 0,
              "INR"
            )}
            description="Revenue recovered by RecoverAI"
            icon="✓"
            type="green"
          />

        </div>

        {/* ======================================================
            AI RECOVERY PIPELINE
        ====================================================== */}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">

          <div className="border-b border-slate-800 px-6 py-5">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
                  Autonomous Recovery Engine
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                  Decision & Governance Pipeline
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  RecoverAI automatically evaluates failed
                  payments and escalates sensitive decisions
                  to humans.
                </p>

              </div>

              <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                Live System
              </div>

            </div>

          </div>

          <div className="grid gap-0 lg:grid-cols-4">

            <PipelineStep
              number="01"
              title="Payment Failure"
              description="Failed transaction received"
              icon="↘"
              active
            />

            <PipelineStep
              number="02"
              title="AI Analysis"
              description="Risk & customer history evaluated"
              icon="✦"
              active
            />

            <PipelineStep
              number="03"
              title="Policy Decision"
              description="Automatic or human governed"
              icon="◆"
              active
              highlighted={
                cases.length > 0
              }
            />

            <PipelineStep
              number="04"
              title="Recovery"
              description="Execute authorized strategy"
              icon="✓"
              active
            />

          </div>

        </div>

        {/* ======================================================
            QUEUE AREA
        ====================================================== */}

        {loading && (
          <LoadingState />
        )}

        {!loading &&
          !error &&
          cases.length === 0 && (
            <EmptyQueue
              analytics={analytics}
              recentActivities={
                recentActivities
              }
              formatCurrency={
                formatCurrency
              }
              formatDate={formatDate}
              strategyLabel={
                strategyLabel
              }
              statusLabel={
                statusLabel
              }
              failureLabel={
                failureLabel
              }
          />
        )}

        {/* ======================================================
            ACTIVE RECOVERY CASES
        ====================================================== */}

        {!loading &&
          cases.length > 0 && (
            <div className="mt-6">

              <div className="mb-4 flex items-end justify-between">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                    Human Review Required
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Decisions awaiting authorization
                  </h2>

                </div>

                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-300">
                  {cases.length}{" "}
                  {cases.length === 1
                    ? "case"
                    : "cases"}
                </span>

              </div>

              <div className="space-y-5">

                {cases.map((item) => (
                  <RecoveryCaseCard
                    key={item.campaign_id}
                    item={item}
                    actionLoading={
                      actionLoading
                    }
                    performAction={
                      performAction
                    }
                    formatCurrency={
                      formatCurrency
                    }
                    formatDate={
                      formatDate
                    }
                    strategyLabel={
                      strategyLabel
                    }
                    failureLabel={
                      failureLabel
                    }
                    confidenceLabel={
                      confidenceLabel
                    }
                    confidencePercent={
                      confidencePercent
                    }
                    retryLabel={
                      retryLabel
                    }
                  />
                ))}

              </div>

            </div>
          )}

        {/* ======================================================
            FOOTER
        ====================================================== */}

        <div className="mt-8 flex flex-col gap-2 border-t border-slate-800/70 pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2">

            <span className="relative flex h-1.5 w-1.5">

              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />

              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />

            </span>

            Recovery queue synchronized with RecoverAI API

          </div>

          <div>

            {cases.length} pending review
            {cases.length === 1
              ? ""
              : "s"}

          </div>

        </div>

      </div>

    </section>
  );
}

/* ================================================================
   STATUS STRIP
================================================================ */

function StatusStrip({
  icon,
  title,
  value,
  description,
  type,
}: {
  icon: string;
  title: string;
  value: string;
  description: string;
  type: "green" | "amber" | "cyan";
}) {
  const styles = {
    green: {
      border:
        "border-emerald-500/10",
      icon:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      value: "text-emerald-300",
    },

    amber: {
      border:
        "border-amber-500/10",
      icon:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
      value: "text-amber-300",
    },

    cyan: {
      border:
        "border-cyan-500/10",
      icon:
        "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
      value: "text-cyan-300",
    },
  };

  const style = styles[type];

  return (
    <div
      className={`rounded-xl border ${style.border} bg-slate-900/50 p-4`}
    >

      <div className="flex items-center gap-3">

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[10px] font-bold ${style.icon}`}
        >
          {icon}
        </div>

        <div className="min-w-0">

          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {title}
          </p>

          <p
            className={`mt-0.5 text-sm font-semibold ${style.value}`}
          >
            {value}
          </p>

        </div>

      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        {description}
      </p>

    </div>
  );
}

/* ================================================================
   SUMMARY CARD
================================================================ */

function SummaryCard({
  label,
  value,
  description,
  icon,
  type,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: string;
  type: "green" | "amber" | "cyan";
}) {
  const styles = {
    green: {
      icon:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      value: "text-emerald-300",
    },

    amber: {
      icon:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
      value: "text-amber-300",
    },

    cyan: {
      icon:
        "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
      value: "text-cyan-300",
    },
  };

  const style = styles[type];

  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900">

      <div className="flex items-start justify-between">

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${style.icon}`}
        >
          {icon}
        </div>

      </div>

      <p
        className={`mt-4 text-2xl font-semibold tracking-tight ${style.value}`}
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
   PIPELINE STEP
================================================================ */

function PipelineStep({
  number,
  title,
  description,
  icon,
  active,
  highlighted = false,
}: {
  number: string;
  title: string;
  description: string;
  icon: string;
  active: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative border-b border-slate-800 p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 ${
        highlighted
          ? "bg-amber-500/[0.025]"
          : ""
      }`}
    >

      <div className="flex items-center justify-between">

        <span className="text-[9px] font-semibold tracking-[0.18em] text-slate-600">
          {number}
        </span>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold ${
            highlighted
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : active
                ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                : "border-slate-800 bg-slate-950 text-slate-600"
          }`}
        >
          {icon}
        </div>

      </div>

      <h3 className="mt-5 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-1 text-[10px] leading-5 text-slate-600">
        {description}
      </p>

      {highlighted && (
        <div className="mt-4 flex items-center gap-2">

          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

          <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400">
            Human attention
          </span>

        </div>
      )}

    </div>
  );
}

/* ================================================================
   LOADING
================================================================ */

function LoadingState() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-12">

      <div className="mx-auto max-w-md">

        <div className="flex justify-center">

          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">

            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />

          </div>

        </div>

        <p className="mt-5 text-center text-sm font-medium text-slate-300">
          Synchronizing recovery decisions
        </p>

        <p className="mt-1 text-center text-xs text-slate-600">
          Reading the latest state from the RecoverAI
          recovery engine...
        </p>

        <div className="mt-6 space-y-2">

          <div className="h-2 animate-pulse rounded-full bg-slate-800" />

          <div className="h-2 w-3/4 animate-pulse rounded-full bg-slate-800" />

          <div className="h-2 w-1/2 animate-pulse rounded-full bg-slate-800" />

        </div>

      </div>

    </div>
  );
}

/* ================================================================
   EMPTY QUEUE
================================================================ */

function EmptyQueue({
  analytics,
  recentActivities,
  formatCurrency,
  formatDate,
  strategyLabel,
  statusLabel,
  failureLabel,
}: {
  analytics: AnalyticsData | null;
  recentActivities: Activity[];
  formatCurrency: (
    amount: number,
    currency?: string
  ) => string;
  formatDate: (
    date?: string | null
  ) => string;
  strategyLabel: (
    strategy?: string
  ) => string;
  statusLabel: (
    status?: string
  ) => string;
  failureLabel: (
    reason?: string
  ) => string;
}) {
  return (
    <div className="mt-6 space-y-6">

      {/* MAIN EMPTY STATE */}

      <div className="overflow-hidden rounded-2xl border border-emerald-500/10 bg-slate-900/70">

        <div className="relative p-10 sm:p-14">

          <div className="pointer-events-none absolute inset-0 overflow-hidden">

            <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/[0.025] blur-3xl" />

          </div>

          <div className="relative mx-auto max-w-2xl text-center">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">

              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/5 text-2xl text-emerald-400">
                ✓
              </div>

            </div>

            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
              All clear
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Recovery queue is clear
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
              No recovery decisions currently require
              human authorization. RecoverAI is monitoring
              failed payments and automatically processing
              decisions that fall within approved policy
              boundaries.
            </p>

            {/* LIVE INDICATOR */}

            <div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-3 rounded-xl border border-emerald-500/10 bg-slate-950/70 px-5 py-4">

              <span className="relative flex h-2.5 w-2.5">

                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />

              </span>

              <div className="text-left">

                <p className="text-xs font-semibold text-emerald-300">
                  AI recovery engine monitoring
                </p>

                <p className="mt-0.5 text-[10px] text-slate-600">
                  Waiting for the next recovery decision
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* QUEUE STATUS */}

        <div className="grid border-t border-slate-800 sm:grid-cols-3">

          <QueueState
            icon="✦"
            title="AI Monitoring"
            value="Active"
            description="Failed payments evaluated"
            type="cyan"
          />

          <QueueState
            icon="◆"
            title="Human Governance"
            value="Standby"
            description="No decisions blocked"
            type="green"
          />

          <QueueState
            icon="✓"
            title="Execution"
            value="Ready"
            description="Approved actions can execute"
            type="green"
          />

        </div>

      </div>

      {/* PERFORMANCE SNAPSHOT */}

      <div className="grid gap-5 lg:grid-cols-3">

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 lg:col-span-2">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recovery Intelligence
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Engine performance snapshot
              </h2>

              <p className="mt-1 text-xs text-slate-600">
                Current recovery activity across the system.
              </p>

            </div>

            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-300">
              Live
            </span>

          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">

            <MetricBox
              label="Failed Payments"
              value={
                analytics?.total_failed_payments ??
                0
              }
              detail={
                analytics
                  ? formatCurrency(
                      analytics.failed_payment_value,
                      "INR"
                    )
                  : "₹0"
              }
            />

            <MetricBox
              label="AI Campaigns"
              value={
                analytics?.total_recovery_campaigns ??
                0
              }
              detail="Decisions generated"
            />

            <MetricBox
              label="Recovery Rate"
              value={`${analytics?.recovery_rate ?? 0}%`}
              detail="Successful recoveries"
            />

          </div>

        </div>

        {/* GOVERNANCE */}

        <div className="rounded-2xl border border-violet-500/10 bg-slate-900/70 p-6">

          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            ◆
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
            Human Governance
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            Oversight layer ready
          </h2>

          <p className="mt-2 text-xs leading-5 text-slate-600">
            Sensitive recovery decisions are held here
            until an authorized human approves or rejects
            them.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5">

            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            <span className="text-[10px] text-slate-400">
              No intervention required
            </span>

          </div>

        </div>

      </div>

      {/* RECENT DECISIONS */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70">

        <div className="flex flex-col gap-2 border-b border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recent Activity
            </p>

            <h2 className="mt-1 text-lg font-semibold text-white">
              Latest AI recovery decisions
            </h2>

            <p className="mt-1 text-xs text-slate-600">
              Recent decisions remain visible even when
              the human review queue is empty.
            </p>

          </div>

          <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-[9px] text-slate-500">
            {recentActivities.length} recent
          </span>

        </div>

        {recentActivities.length === 0 ? (

          <div className="p-10 text-center">

            <p className="text-sm text-slate-500">
              No recent recovery activity available.
            </p>

            <p className="mt-1 text-xs text-slate-700">
              Activity will appear here after payments
              are processed.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[850px]">

              <thead>

                <tr className="border-b border-slate-800 bg-slate-950/50 text-left">

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                    Customer
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                    Decision
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                    Status
                  </th>

                  <th className="px-5 py-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                    Time
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800">

                {recentActivities.map(
                  (activity) => (
                    <tr
                      key={
                        activity.campaign_id
                      }
                      className="transition hover:bg-slate-800/30"
                    >

                      <td className="px-5 py-4">

                        <p className="text-sm font-medium text-slate-300">
                          {activity.customer}
                        </p>

                        <p className="mt-1 font-mono text-[9px] text-slate-700">
                          Campaign #
                          {activity.campaign_id}
                        </p>

                      </td>

                      <td className="px-5 py-4">

                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(
                            activity.amount,
                            activity.currency
                          )}
                        </p>

                        <p className="mt-1 text-[9px] text-slate-700">
                          {failureLabel(
                            activity.failure_reason
                          )}
                        </p>

                      </td>

                      <td className="px-5 py-4">

                        <span className="inline-flex rounded-lg border border-cyan-500/10 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
                          {strategyLabel(
                            activity.strategy
                          )}
                        </span>

                      </td>

                      <td className="px-5 py-4">

                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${
                            activity.status ===
                            "executed_success"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : activity.status ===
                                  "rejected"
                                ? "border-red-500/20 bg-red-500/10 text-red-300"
                                : "border-slate-700 bg-slate-800 text-slate-300"
                          }`}
                        >
                          {statusLabel(
                            activity.status
                          )}
                        </span>

                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {formatDate(
                          activity.created_at
                        )}
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}

/* ================================================================
   QUEUE STATE
================================================================ */

function QueueState({
  icon,
  title,
  value,
  description,
  type,
}: {
  icon: string;
  title: string;
  value: string;
  description: string;
  type: "green" | "cyan";
}) {
  const iconClass =
    type === "green"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";

  const valueClass =
    type === "green"
      ? "text-emerald-300"
      : "text-cyan-300";

  return (
    <div className="border-b border-slate-800 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">

      <div className="flex items-center gap-3">

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs ${iconClass}`}
        >
          {icon}
        </div>

        <div>

          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {title}
          </p>

          <p
            className={`mt-0.5 text-sm font-semibold ${valueClass}`}
          >
            {value}
          </p>

        </div>

      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        {description}
      </p>

    </div>
  );
}

/* ================================================================
   METRIC BOX
================================================================ */

function MetricBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">

      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-white">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-slate-600">
        {detail}
      </p>

    </div>
  );
}

/* ================================================================
   RECOVERY CASE CARD
================================================================ */

function RecoveryCaseCard({
  item,
  actionLoading,
  performAction,
  formatCurrency,
  formatDate,
  strategyLabel,
  failureLabel,
  confidenceLabel,
  confidencePercent,
  retryLabel,
}: {
  item: RecoveryCase;
  actionLoading: number | null;
  performAction: (
    campaignId: number,
    action: Action
  ) => Promise<void>;
  formatCurrency: (
    amount: number,
    currency?: string
  ) => string;
  formatDate: (
    date?: string | null
  ) => string;
  strategyLabel: (
    strategy?: string
  ) => string;
  failureLabel: (
    reason?: string
  ) => string;
  confidenceLabel: (
    confidence?: number | null
  ) => string;
  confidencePercent: (
    confidence?: number | null
  ) => number;
  retryLabel: (
    minutes?: number | null
  ) => string | null;
}) {
  const confidence =
    item.confidence ?? 0;

  const confidenceValue =
    confidencePercent(
      item.confidence
    );

  const retry =
    retryLabel(
      item.retry_after_minutes
    );

  const busy =
    actionLoading === item.campaign_id;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/10 bg-slate-900/80">

      {/* HEADER */}

      <div className="flex flex-col gap-5 border-b border-slate-800 px-6 py-5 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-4">

          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-lg font-semibold text-amber-400">

            <span className="absolute inset-0 animate-pulse rounded-xl bg-amber-400/5" />

            <span className="relative">
              !
            </span>

          </div>

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <h2 className="font-semibold text-white">
                Campaign #
                {item.campaign_id}
              </h2>

              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Human Review
              </span>

            </div>

            <p className="mt-1 font-mono text-xs text-slate-600">
              {item.payment_id}
            </p>

          </div>

        </div>

        <div className="md:text-right">

          <p className="text-2xl font-bold text-white">
            {formatCurrency(
              item.amount,
              item.currency
            )}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Failed payment value
          </p>

        </div>

      </div>

      {/* INFORMATION */}

      <div className="grid gap-6 p-6 lg:grid-cols-3">

        {/* CUSTOMER */}

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Customer
          </p>

          <div className="mt-3">

            <p className="font-medium text-white">
              {item.customer.name}
            </p>

            <p className="mt-1 break-all text-xs text-slate-500">
              {item.customer.email}
            </p>

            {item.customer.phone && (
              <p className="mt-1 text-xs text-slate-500">
                {item.customer.phone}
              </p>
            )}

          </div>

        </div>

        {/* FAILURE */}

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Payment Failure
          </p>

          <div className="mt-3">

            <p className="font-medium text-white">
              {failureLabel(
                item.failure_reason
              )}
            </p>

            <p className="mt-1 text-xs capitalize text-slate-500">
              {item.payment_method.replaceAll(
                "_",
                " "
              )}{" "}
              payment method
            </p>

          </div>

        </div>

        {/* AI */}

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            AI Recommendation
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">

            <span className="rounded-lg border border-cyan-500/10 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase text-cyan-300">
              {strategyLabel(
                item.strategy
              )}
            </span>

            <span className="text-xs text-slate-500">
              {confidenceValue}% confidence
            </span>

          </div>

          {retry && (
            <p className="mt-2 text-xs text-slate-500">
              Suggested retry:{" "}
              <span className="text-slate-300">
                {retry}
              </span>
            </p>
          )}

          {item.discount_percent !==
            null &&
            item.discount_percent !==
              undefined && (
              <p className="mt-2 text-xs text-slate-500">
                Suggested discount:{" "}
                <span className="text-slate-300">
                  {item.discount_percent}%
                </span>
              </p>
            )}

        </div>

      </div>

      {/* AI EXPLANATION */}

      <div className="mx-6 mb-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

          <div className="max-w-3xl">

            <div className="flex items-center gap-2">

              <span className="text-sm text-cyan-400">
                ✦
              </span>

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                AI Decision Explanation
              </p>

            </div>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {item.reason}
            </p>

          </div>

          <div className="min-w-[130px] shrink-0">

            <p className="text-[10px] uppercase tracking-wider text-slate-600">
              Confidence
            </p>

            <p className="mt-1 text-sm font-semibold text-white">
              {confidenceLabel(
                item.confidence
              )}
            </p>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">

              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{
                  width: `${confidenceValue}%`,
                }}
              />

            </div>

          </div>

        </div>

      </div>

      {/* GOVERNANCE */}

      <div className="mx-6 mb-6 flex gap-3 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">

        <span className="mt-0.5 text-amber-400">
          ⚠
        </span>

        <div>

          <p className="text-xs font-semibold text-amber-300">
            Automated recovery blocked
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-400/70">
            RecoverAI requires explicit human
            authorization before this recovery
            campaign can proceed.
          </p>

        </div>

      </div>

      {/* METADATA */}

      <div className="mx-6 mb-6 grid gap-3 sm:grid-cols-3">

        <InfoItem
          label="Transaction ID"
          value={`#${item.transaction_id}`}
        />

        <InfoItem
          label="Campaign Status"
          value={item.status.replaceAll(
            "_",
            " "
          )}
        />

        <InfoItem
          label="Created"
          value={formatDate(
            item.created_at
          )}
        />

      </div>

      {/* ACTIONS */}

      <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950/50 px-6 py-5 sm:flex-row sm:justify-end">

        <button
          onClick={() =>
            performAction(
              item.campaign_id,
              "reject"
            )
          }
          disabled={busy}
          className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:border-red-800 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Processing..."
            : "Reject Recovery"}
        </button>

        <button
          onClick={() =>
            performAction(
              item.campaign_id,
              "approve"
            )
          }
          disabled={busy}
          className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Processing..."
            : "Approve Recovery"}
        </button>

      </div>

    </div>
  );
}

/* ================================================================
   INFO ITEM
================================================================ */

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">

      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-xs font-medium capitalize text-slate-300">
        {value}
      </p>

    </div>
  );
}
