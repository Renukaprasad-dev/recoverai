"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_CONNECTION_ERROR, API_URL } from "../../lib/api";

type Campaign = {
  campaign_id: number;
  strategy: string;
  reason: string;
  status: string;
  requires_human_approval: boolean;
  confidence: number | null;
  retry_after_minutes: number | null;
  discount_percent: number | null;
};

type Transaction = {
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
  transaction_status: string;
  campaign: Campaign | null;
  created_at: string | null;
};

type TransactionResponse = {
  count: number;
  transactions: Transaction[];
};

type Filter =
  | "all"
  | "failed"
  | "recovered"
  | "recovery_failed";

function formatCurrency(
  amount: number | null | undefined,
  currency = "INR"
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

function formatDate(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pretty(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function strategyLabel(strategy?: string | null) {
  if (!strategy) return "No decision";
  return pretty(strategy);
}

function statusLabel(status: string) {
  switch (status) {
    case "recovered":
    case "executed_success":
      return "Recovered";

    case "recovery_failed":
    case "executed_failed":
      return "Recovery Failed";

    case "pending_human_review":
      return "Pending Review";

    case "planned":
      return "Planned";

    case "rejected":
      return "Rejected";

    case "failed":
      return "Failed";

    default:
      return pretty(status);
  }
}

function statusClass(status: string) {
  switch (status) {
    case "recovered":
    case "executed_success":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";

    case "recovery_failed":
    case "executed_failed":
    case "rejected":
      return "border-red-500/20 bg-red-500/10 text-red-300";

    case "pending_human_review":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";

    case "planned":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";

    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

function isRecovered(status: string) {
  return (
    status === "recovered" ||
    status === "executed_success"
  );
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [selected, setSelected] =
    useState<Transaction | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      setRefreshing(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/v1/recovery/transactions`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Transaction request failed: ${response.status}`
        );
      }

      const result: TransactionResponse =
        await response.json();

      setTransactions(
        Array.isArray(result.transactions)
          ? result.transactions
          : []
      );
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
    loadTransactions();
  }, [loadTransactions]);

  /*
   * ============================================================
   * FILTERED TRANSACTIONS
   * ============================================================
   */

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        transaction.payment_id
          .toLowerCase()
          .includes(query) ||
        transaction.customer.name
          .toLowerCase()
          .includes(query) ||
        transaction.customer.email
          .toLowerCase()
          .includes(query) ||
        transaction.failure_reason
          .toLowerCase()
          .includes(query) ||
        transaction.transaction_id
          .toString()
          .includes(query);

      const status = transaction.transaction_status;

      const matchesFilter =
        filter === "all" ||
        (filter === "recovered" &&
          isRecovered(status)) ||
        (filter === "recovery_failed" &&
          (status === "recovery_failed" ||
            status === "executed_failed" ||
            status === "rejected")) ||
        (filter === "failed" &&
          (status === "failed" ||
            status === "pending_human_review" ||
            status === "planned"));

      return matchesSearch && matchesFilter;
    });
  }, [transactions, search, filter]);

  /*
   * ============================================================
   * SUMMARY
   * ============================================================
   */

  const totalValue = useMemo(() => {
    return transactions.reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount || 0),
      0
    );
  }, [transactions]);

  const recoveredValue = useMemo(() => {
    return transactions
      .filter((transaction) =>
        isRecovered(transaction.transaction_status)
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );
  }, [transactions]);

  const failedValue = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          !isRecovered(
            transaction.transaction_status
          )
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );
  }, [transactions]);

  /*
   * ============================================================
   * LOADING SCREEN
   * ============================================================
   */

  if (loading) {
    return (
      <section className="min-h-screen bg-[#020617] text-white">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="animate-pulse">
            <div className="h-3 w-24 rounded bg-slate-800" />

            <div className="mt-4 h-10 w-64 rounded bg-slate-800" />

            <div className="mt-3 h-4 w-[520px] max-w-full rounded bg-slate-800" />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-32 rounded-2xl border border-slate-800 bg-slate-900"
                  />
                )
              )}
            </div>

            <div className="mt-6 h-16 rounded-2xl border border-slate-800 bg-slate-900" />

            <div className="mt-5 h-[500px] rounded-2xl border border-slate-800 bg-slate-900" />
          </div>
        </div>
      </section>
    );
  }

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <section className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* HEADER */}

        <div className="flex flex-col gap-5 border-b border-slate-800/70 pb-7 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
              Operations
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Transactions
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Monitor failed payments, recovery decisions,
              and transaction outcomes.
            </p>
          </div>

          <button
            onClick={loadTransactions}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-800 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={
                refreshing ? "animate-spin" : ""
              }
            >
              ↻
            </span>

            {refreshing
              ? "Refreshing..."
              : "Refresh data"}
          </button>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-300">
                Transactions unavailable
              </p>

              <p className="mt-1 text-xs text-red-400">
                {error}
              </p>
            </div>

            <button
              onClick={loadTransactions}
              className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-900"
            >
              Try again
            </button>
          </div>
        )}

        {/* SUMMARY */}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">

          <SummaryCard
            label="Transactions"
            value={transactions.length.toString()}
            description="Payment attempts recorded"
          />

          <SummaryCard
            label="Payment Value"
            value={formatCurrency(totalValue)}
            description="Total transaction value"
          />

          <SummaryCard
            label="Recovered Value"
            value={formatCurrency(recoveredValue)}
            description="Successfully recovered revenue"
            positive
          />

        </div>

        {/* FILTERS */}

        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">

            {/* SEARCH */}

            <div className="relative flex-1">

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search customer, payment ID, email, transaction ID, or failure reason..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/50"
              />

            </div>

            {/* FILTERS */}

            <div className="flex overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1">

              {[
                ["all", "All"],
                ["failed", "Failed"],
                ["recovered", "Recovered"],
                ["recovery_failed", "Recovery Failed"],
              ].map(([value, label]) => (

                <button
                  key={value}
                  onClick={() =>
                    setFilter(value as Filter)
                  }
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                    filter === value
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>

              ))}

            </div>

          </div>

          {/* ACTIVE FILTER INFO */}

          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">

            <span>
              {search
                ? `Searching for "${search}"`
                : "Showing all available transactions"}
            </span>

            <span>
              {filteredTransactions.length} results
            </span>

          </div>

        </div>

        {/* TABLE */}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1050px]">

              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-left">

                  <TableHeader>
                    Transaction
                  </TableHeader>

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
                    AI Strategy
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Date
                  </TableHeader>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">

                {filteredTransactions.length === 0 ? (

                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-20 text-center"
                    >

                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-xl text-slate-600">
                        ○
                      </div>

                      <p className="mt-4 font-medium text-white">
                        No transactions found
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Try changing the search or filter.
                      </p>

                    </td>
                  </tr>

                ) : (

                  filteredTransactions.map(
                    (transaction) => (

                      <tr
                        key={transaction.transaction_id}
                        onClick={() =>
                          setSelected(transaction)
                        }
                        className="cursor-pointer transition hover:bg-slate-800/40"
                      >

                        {/* TRANSACTION */}

                        <td className="px-5 py-5">

                          <p className="font-medium text-white">
                            #{transaction.transaction_id}
                          </p>

                          <p className="mt-1 max-w-[170px] truncate font-mono text-[10px] text-slate-600">
                            {transaction.payment_id}
                          </p>

                        </td>

                        {/* CUSTOMER */}

                        <td className="px-5 py-5">

                          <p className="font-medium text-slate-200">
                            {transaction.customer.name}
                          </p>

                          <p className="mt-1 max-w-[180px] truncate text-xs text-slate-600">
                            {transaction.customer.email}
                          </p>

                        </td>

                        {/* AMOUNT */}

                        <td className="px-5 py-5">

                          <p className="font-semibold text-white">
                            {formatCurrency(
                              transaction.amount,
                              transaction.currency
                            )}
                          </p>

                          <p className="mt-1 text-[9px] uppercase text-slate-600">
                            {transaction.currency}
                          </p>

                        </td>

                        {/* FAILURE */}

                        <td className="px-5 py-5">

                          <span className="inline-flex rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-400">
                            {pretty(
                              transaction.failure_reason
                            )}
                          </span>

                          <p className="mt-2 text-[10px] capitalize text-slate-600">
                            {transaction.payment_method}
                          </p>

                        </td>

                        {/* AI STRATEGY */}

                        <td className="px-5 py-5">

                          {transaction.campaign ? (

                            <div>

                              <span className="inline-flex rounded-lg border border-cyan-500/10 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
                                {strategyLabel(
                                  transaction.campaign.strategy
                                )}
                              </span>

                              {transaction.campaign
                                .confidence !== null &&
                                transaction.campaign
                                  .confidence !==
                                  undefined && (

                                  <p className="mt-2 text-[10px] text-slate-600">
                                    {Math.round(
                                      transaction
                                        .campaign
                                        .confidence * 100
                                    )}
                                    % confidence
                                  </p>

                                )}

                            </div>

                          ) : (

                            <span className="text-xs text-slate-600">
                              No campaign
                            </span>

                          )}

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-5">

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${statusClass(
                              transaction.transaction_status
                            )}`}
                          >
                            {statusLabel(
                              transaction.transaction_status
                            )}
                          </span>

                        </td>

                        {/* DATE */}

                        <td className="px-5 py-5 text-xs text-slate-500">
                          {formatDate(
                            transaction.created_at
                          )}
                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

          {/* TABLE FOOTER */}

          <div className="flex flex-col gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-xs text-slate-600">
              Showing{" "}
              <span className="text-slate-400">
                {filteredTransactions.length}
              </span>{" "}
              of{" "}
              <span className="text-slate-400">
                {transactions.length}
              </span>{" "}
              transactions
            </p>

            <p className="text-[10px] text-slate-600">
              Failed value:{" "}
              <span className="text-slate-400">
                {formatCurrency(failedValue)}
              </span>
            </p>

          </div>

        </div>

      </div>

      {/* =========================================================
          DETAILS DRAWER
      ========================================================= */}

      {selected && (

        <div className="fixed inset-0 z-50">

          {/* BACKDROP */}

          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          {/* DRAWER */}

          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-800 bg-[#020617] shadow-2xl">

            {/* DRAWER HEADER */}

            <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#020617]/95 px-6 py-5 backdrop-blur">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
                    Transaction #{selected.transaction_id}
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Transaction Details
                  </h2>

                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-lg text-slate-500 transition hover:bg-slate-900 hover:text-white"
                  aria-label="Close transaction details"
                >
                  ×
                </button>

              </div>

            </div>

            <div className="space-y-7 p-6">

              {/* STATUS CARD */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

                <div className="flex items-center justify-between gap-4">

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Transaction Status
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Current payment outcome
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide ${statusClass(
                      selected.transaction_status
                    )}`}
                  >
                    {statusLabel(
                      selected.transaction_status
                    )}
                  </span>

                </div>

                <p className="mt-6 text-3xl font-semibold text-white">
                  {formatCurrency(
                    selected.amount,
                    selected.currency
                  )}
                </p>

              </div>

              {/* CUSTOMER */}

              <DetailSection title="Customer">

                <DetailRow
                  label="Name"
                  value={selected.customer.name}
                />

                <DetailRow
                  label="Email"
                  value={selected.customer.email}
                />

                <DetailRow
                  label="Phone"
                  value={
                    selected.customer.phone || "—"
                  }
                />

              </DetailSection>

              {/* PAYMENT */}

              <DetailSection title="Payment Information">

                <DetailRow
                  label="Payment ID"
                  value={selected.payment_id}
                  mono
                />

                <DetailRow
                  label="Payment Method"
                  value={pretty(
                    selected.payment_method
                  )}
                />

                <DetailRow
                  label="Currency"
                  value={selected.currency}
                />

                <DetailRow
                  label="Amount"
                  value={formatCurrency(
                    selected.amount,
                    selected.currency
                  )}
                />

                <DetailRow
                  label="Failure Reason"
                  value={pretty(
                    selected.failure_reason
                  )}
                  danger
                />

              </DetailSection>

              {/* AI DECISION */}

              {selected.campaign ? (

                <DetailSection title="AI Recovery Decision">

                  <div className="mb-5 flex items-center justify-between">

                    <span className="text-xs text-slate-600">
                      Strategy
                    </span>

                    <span className="rounded-lg border border-cyan-500/10 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                      {strategyLabel(
                        selected.campaign.strategy
                      )}
                    </span>

                  </div>

                  <DetailRow
                    label="Campaign ID"
                    value={`#${selected.campaign.campaign_id}`}
                  />

                  <DetailRow
                    label="Campaign Status"
                    value={pretty(
                      selected.campaign.status
                    )}
                  />

                  <DetailRow
                    label="Human Approval"
                    value={
                      selected.campaign
                        .requires_human_approval
                        ? "Required"
                        : "Not required"
                    }
                  />

                  {selected.campaign.confidence !==
                    null &&
                    selected.campaign.confidence !==
                      undefined && (

                      <DetailRow
                        label="AI Confidence"
                        value={`${Math.round(
                          selected.campaign.confidence *
                            100
                        )}%`}
                      />

                    )}

                  {selected.campaign
                    .retry_after_minutes !==
                    null &&
                    selected.campaign
                      .retry_after_minutes !==
                      undefined && (

                      <DetailRow
                        label="Retry After"
                        value={`${selected.campaign.retry_after_minutes} minutes`}
                      />

                    )}

                  {selected.campaign
                    .discount_percent !== null &&
                    selected.campaign
                      .discount_percent !==
                      undefined && (

                      <DetailRow
                        label="Discount"
                        value={`${selected.campaign.discount_percent}%`}
                      />

                    )}

                  <div className="mt-5 border-t border-slate-800 pt-5">

                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      AI Explanation
                    </p>

                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">

                      <p className="text-sm leading-6 text-slate-400">
                        {selected.campaign.reason}
                      </p>

                    </div>

                  </div>

                </DetailSection>

              ) : (

                <DetailSection title="AI Recovery Decision">

                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-5 text-center">

                    <p className="text-sm text-slate-400">
                      No recovery campaign has been generated for this transaction.
                    </p>

                  </div>

                </DetailSection>

              )}

              {/* CREATED */}

              <div className="border-t border-slate-800 pt-5">

                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                  Created
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {formatDate(
                    selected.created_at
                  )}
                </p>

              </div>

            </div>

          </div>

        </div>

      )}

    </section>
  );
}

/* ================================================================
   SUMMARY CARD
================================================================ */

function SummaryCard({
  label,
  value,
  description,
  positive = false,
}: {
  label: string;
  value: string;
  description: string;
  positive?: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900">

      <div className="flex items-start justify-between">

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <span
          className={`h-2 w-2 rounded-full ${
            positive
              ? "bg-emerald-400"
              : "bg-slate-600"
          }`}
        />

      </div>

      <p
        className={`mt-4 text-2xl font-semibold tracking-tight ${
          positive
            ? "text-emerald-300"
            : "text-white"
        }`}
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
   TABLE HEADER
================================================================ */

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

/* ================================================================
   DETAIL SECTION
================================================================ */

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
        {title}
      </p>

      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="space-y-4">
          {children}
        </div>
      </div>

    </div>
  );
}

/* ================================================================
   DETAIL ROW
================================================================ */

function DetailRow({
  label,
  value,
  mono = false,
  danger = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5">

      <span className="shrink-0 text-xs text-slate-600">
        {label}
      </span>

      <span
        className={`max-w-[280px] break-words text-right text-xs ${
          mono
            ? "font-mono"
            : ""
        } ${
          danger
            ? "text-red-300"
            : "text-slate-300"
        }`}
      >
        {value}
      </span>

    </div>
  );
}
