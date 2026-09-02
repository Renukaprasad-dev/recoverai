"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Customer = {
  name: string;
  email: string;
  phone?: string | null;
};

type WebhookResponse = Record<string, any>;

type RecoveryCase = {
  campaign_id: number;
  transaction_id: number;
  payment_id: string;
  customer: Customer;
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

type Transaction = {
  transaction_id: number;
  payment_id: string;
  customer: Customer;
  amount: number;
  currency: string;
  failure_reason: string;
  payment_method: string;
  transaction_status: string;
  campaign: RecoveryCase | null;
  created_at: string | null;
};

type PendingResponse = {
  count: number;
  cases: RecoveryCase[];
};

type TransactionResponse = {
  count: number;
  transactions: Transaction[];
};

/* ============================================================
   NORMALIZE TRANSACTION + CAMPAIGN
   ============================================================
   The backend's transaction.campaign object does not always
   contain transaction-level fields such as amount, currency,
   customer, or payment method. Always merge both objects before
   storing the campaign in React state. This prevents values such
   as ₹NaN from appearing in the UI.
============================================================ */

function toRecoveryCase(
  transaction: Transaction
): RecoveryCase | null {
  const backendCampaign = transaction.campaign;

  if (!backendCampaign) {
    return null;
  }

  const amount = Number(transaction.amount);

  return {
    campaign_id: Number(backendCampaign.campaign_id),
    transaction_id: Number(transaction.transaction_id),
    payment_id: transaction.payment_id,

    customer: {
      name: transaction.customer?.name ?? "",
      email: transaction.customer?.email ?? "",
      phone: transaction.customer?.phone ?? null,
    },

    amount: Number.isFinite(amount) ? amount : 0,
    currency: transaction.currency ?? "INR",
    failure_reason: transaction.failure_reason ?? "",
    payment_method: transaction.payment_method ?? "",

    strategy: backendCampaign.strategy ?? "",
    reason: backendCampaign.reason ?? "",

    retry_after_minutes:
      backendCampaign.retry_after_minutes ?? null,

    discount_percent:
      backendCampaign.discount_percent ?? null,

    requires_human_approval:
      Boolean(backendCampaign.requires_human_approval),

    confidence:
      backendCampaign.confidence === null ||
      backendCampaign.confidence === undefined
        ? 0
        : Number(backendCampaign.confidence) || 0,

    status: backendCampaign.status ?? "planned",

    created_at:
      transaction.created_at ??
      backendCampaign.created_at ??
      null,
  };
}

type DemoStage =
  | "idle"
  | "processing"
  | "review"
  | "approved"
  | "rejected"
  | "executed"
  | "failed";

export default function DemoPage() {
  const [customerName, setCustomerName] =
    useState("Demo Customer");

  const [customerEmail, setCustomerEmail] =
    useState("demo.customer@recoverai.local");

  const [customerPhone, setCustomerPhone] =
    useState("9876543200");

  const [amount, setAmount] =
    useState("10000");

  const [failureReason, setFailureReason] =
    useState("insufficient_funds");

  const [paymentMethod, setPaymentMethod] =
    useState("card");

  const [stage, setStage] =
    useState<DemoStage>("idle");

  const [campaign, setCampaign] =
    useState<RecoveryCase | null>(null);

  const [result, setResult] =
    useState<WebhookResponse | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [transactionId, setTransactionId] =
    useState<number | null>(null);

  const [recoveredAmount, setRecoveredAmount] =
    useState<number | null>(null);

  const [outcome, setOutcome] =
    useState("success");

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  /* ============================================================
     HELPERS
  ============================================================ */

  function formatCurrency(
    value: number | string | null | undefined
  ) {
    const numericValue = Number(value);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(
      Number.isFinite(numericValue)
        ? numericValue
        : 0
    );
  }

  function strategyLabel(strategy?: string) {
    if (!strategy) {
      return "Waiting";
    }

    return strategy
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
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

    return Math.round(
      Math.min(
        Math.max(confidence * 100, 0),
        100
      )
    );
  }

  /* ============================================================
     FIND CREATED TRANSACTION
  ============================================================ */

  async function findTransaction(
    paymentId: string
  ): Promise<Transaction | null> {
    try {
      const response = await fetch(
        `${API_URL}/api/v1/recovery/transactions`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return null;
      }

      const data: TransactionResponse =
        await response.json();

      return (
        data.transactions?.find(
          (item) =>
            item.payment_id === paymentId
        ) ?? null
      );
    } catch (err) {
      console.error(
        "Unable to find transaction:",
        err
      );

      return null;
    }
  }

  /* ============================================================
   FIND CREATED CAMPAIGN
============================================================ */

async function findPendingCampaign(
  paymentId: string
): Promise<RecoveryCase | null> {
  try {
    /*
     * IMPORTANT:
     * Do not treat every campaign as a human-review case.
     *
     * /recovery/pending is the authoritative endpoint for the
     * human-governance queue. A planned/automatic campaign must
     * NOT cause the UI to enter the review state.
     */
    const pendingResponse = await fetch(
      `${API_URL}/api/v1/recovery/pending`,
      {
        cache: "no-store",
      }
    );

    if (pendingResponse.ok) {
      const pendingData: PendingResponse =
        await pendingResponse.json();

      const pendingCampaign =
        pendingData.cases?.find(
          (item) =>
            item.payment_id === paymentId &&
            (
              item.status ===
                "pending_human_review" ||
              item.requires_human_approval === true
            )
        ) ?? null;

      if (pendingCampaign) {
        return pendingCampaign;
      }
    }

    /*
     * If the payment is not in the pending queue, it is NOT
     * a human-review case. Return null and let the caller inspect
     * the actual transaction/campaign state.
     */
    return null;
  } catch (err) {
    console.error(
      "Unable to find pending campaign:",
      err
    );

    return null;
  }
}

/* ============================================================
     SIMULATE PAYMENT FAILURE
  ============================================================ */

  async function simulatePaymentFailure() {
    try {
      setLoading(true);
      clearMessages();

      setStage("processing");
      setCampaign(null);
      setResult(null);
      setTransactionId(null);
      setRecoveredAmount(null);
      setOutcome("success");

      const numericAmount = Number(amount);

      if (!numericAmount || numericAmount <= 0) {
        throw new Error(
          "Please enter a valid payment amount."
        );
      }

      if (!customerName.trim()) {
        throw new Error(
          "Please enter a customer name."
        );
      }

      if (!customerEmail.trim()) {
        throw new Error(
          "Please enter a customer email."
        );
      }

      const paymentId =
        `pay_demo_${Date.now()}`;

      const payload = {
        event: "payment.failed",

        payment: {
          id: paymentId,
          amount: Math.round(numericAmount),
          currency: "INR",
          method: paymentMethod,
          error_reason: failureReason,
        },

        customer: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim() || null,
        },
      };

      /* --------------------------------------------------------
         SEND WEBHOOK
      -------------------------------------------------------- */

      const response = await fetch(
        `${API_URL}/api/v1/webhook/payment-failed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      let webhookData: WebhookResponse = {};

      try {
        webhookData = await response.json();
      } catch {
        webhookData = {};
      }

      if (!response.ok) {
        throw new Error(
          webhookData.detail ||
            `Payment simulation failed (${response.status}).`
        );
      }

      setResult(webhookData);

      /*
       * Give the backend a short amount of time
       * to finish database operations.
       */

      await wait(600);

      /* --------------------------------------------------------
         FIRST: CHECK PENDING HUMAN REVIEW
      -------------------------------------------------------- */

      const pendingCampaign =
        await findPendingCampaign(paymentId);

      if (pendingCampaign) {
        setCampaign(pendingCampaign);

        setTransactionId(
          pendingCampaign.transaction_id
        );

        setStage("review");

        setMessage(
          "Payment failure received. RecoverAI generated a recovery decision that requires human approval."
        );

        return;
      }

      /* --------------------------------------------------------
         SECOND: CHECK ACTUAL TRANSACTION STATE
      -------------------------------------------------------- */

      const transaction =
        await findTransaction(paymentId);

      if (!transaction) {
        throw new Error(
          "Payment was received, but RecoverAI could not locate the created transaction."
        );
      }

      setTransactionId(
        transaction.transaction_id
      );

      const normalizedCampaign =
        toRecoveryCase(transaction);

      if (normalizedCampaign) {
        setCampaign(normalizedCampaign);

        const campaignStatus =
          normalizedCampaign.status;

        const transactionStatus =
          transaction.transaction_status;

        /* ------------------------------------------------------
           ALREADY RECOVERED
        ------------------------------------------------------ */

        if (
          campaignStatus ===
            "executed_success" ||
          transactionStatus === "recovered"
        ) {
          setStage("executed");

          setRecoveredAmount(
            transaction.amount
          );

          setMessage(
            "Payment failure received. RecoverAI automatically executed the recovery successfully."
          );

          return;
        }

        /* ------------------------------------------------------
           RECOVERY FAILED
        ------------------------------------------------------ */

        if (
          campaignStatus ===
            "executed_failed" ||
          transactionStatus ===
            "recovery_failed"
        ) {
          setStage("failed");

          setRecoveredAmount(0);

          setMessage(
            "RecoverAI processed the recovery, but the recovery attempt failed."
          );

          return;
        }

        /* ------------------------------------------------------
           PLANNED / NOT YET EXECUTED
        ------------------------------------------------------ */

        if (
          campaignStatus === "planned"
        ) {
          setStage("processing");

          setMessage(
            "RecoverAI created a recovery plan. The recovery action is scheduled but has not been executed yet."
          );

          return;
        }

        /* ------------------------------------------------------
           HUMAN REVIEW STATE
        ------------------------------------------------------ */

        if (
          normalizedCampaign.requires_human_approval === true ||
          normalizedCampaign.status ===
            "pending_human_review"
        ) {
          setStage("review");

          setMessage(
            "RecoverAI requires human authorization before this recovery can proceed."
          );

          return;
        }
      }

      /* --------------------------------------------------------
         FALLBACK
      -------------------------------------------------------- */

      setStage("processing");

      setMessage(
        "Payment failure was received and the recovery decision was created."
      );
    } catch (err) {
      console.error(err);

      setStage("idle");

      setError(
        err instanceof Error
          ? err.message
          : "Unable to simulate payment failure."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     APPROVE / REJECT
  ============================================================ */

  async function performAction(
    action: "approve" | "reject"
  ) {
    if (!campaign) {
      return;
    }

    if (
      campaign.status !== "pending_human_review" &&
      campaign.requires_human_approval !== true
    ) {
      setError(
        "This recovery campaign is no longer pending human review. Refresh the transaction state before taking another governance action."
      );

      await refreshCampaignState();

      return;
    }

    try {
      setLoading(true);
      clearMessages();

      const response = await fetch(
        `${API_URL}/api/v1/recovery/${campaign.campaign_id}/${action}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      let data: WebhookResponse = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Unable to ${action} recovery campaign.`
        );
      }

      /*
       * Save the API response so the demo
       * can show exactly what the backend returned.
       */

      setResult((previous) => ({
        ...(previous || {}),
        governance_action: action,
        governance_response: data,
      }));

      if (action === "reject") {
        setStage("rejected");

        setMessage(
          `Campaign #${campaign.campaign_id} was rejected by human review.`
        );

        await refreshCampaignState();

        return;
      }

      /*
       * Approval does NOT mean recovery is completed.
       * It only authorizes execution.
       */

      setStage("approved");

      setMessage(
        `Campaign #${campaign.campaign_id} was approved. Recovery execution is now authorized.`
      );

      await refreshCampaignState();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} recovery campaign.`
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     EXECUTE RECOVERY
  ============================================================ */

  async function executeRecovery() {
    if (!campaign) {
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      const campaignAmount =
        Number(campaign.amount);

      const amountValue =
        recoveredAmount !== null
          ? Number(recoveredAmount)
          : campaignAmount;

      if (!Number.isFinite(amountValue)) {
        throw new Error(
          "RecoverAI returned an invalid payment amount."
        );
      }

      if (
        outcome === "success" &&
        (!amountValue || amountValue <= 0)
      ) {
        throw new Error(
          "Please enter a valid recovered amount."
        );
      }

      const response = await fetch(
        `${API_URL}/api/v1/recovery/${campaign.campaign_id}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            outcome,

            recovered_amount:
              outcome === "success"
                ? amountValue
                : 0,
          }),
        }
      );

      let data: WebhookResponse = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to execute recovery."
        );
      }

      /*
       * Preserve execution response.
       */

      setResult((previous) => ({
        ...(previous || {}),
        execution_response: data,
      }));

      /*
       * Refresh transaction from backend
       * instead of assuming success.
       */

      await wait(300);

      const transaction =
        await findTransaction(
          campaign.payment_id
        );

      if (transaction) {
        setTransactionId(
          transaction.transaction_id
        );

        const normalizedCampaign =
          toRecoveryCase(transaction);

        if (normalizedCampaign) {
          setCampaign(normalizedCampaign);
        }

        if (
          transaction.transaction_status ===
            "recovered" ||
          normalizedCampaign?.status ===
            "executed_success"
        ) {
          setStage("executed");

          setRecoveredAmount(
            amountValue
          );

          setMessage(
            "Recovery executed successfully."
          );

          return;
        }

        if (
          transaction.transaction_status ===
            "recovery_failed" ||
          normalizedCampaign?.status ===
            "executed_failed"
        ) {
          setStage("failed");

          setRecoveredAmount(0);

          setMessage(
            "Recovery execution completed, but the payment was not recovered."
          );

          return;
        }
      }

      /*
       * If the backend accepted the execution request
       * but transaction state is not immediately updated,
       * don't falsely claim success.
       */

      if (outcome === "success") {
        setStage("executed");

        setRecoveredAmount(
          amountValue
        );

        setMessage(
          "Recovery execution was accepted by RecoverAI."
        );
      } else {
        setStage("failed");

        setRecoveredAmount(0);

        setMessage(
          "Recovery execution completed with a failed outcome."
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to execute recovery."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     REFRESH CAMPAIGN STATE
  ============================================================ */

  async function refreshCampaignState() {
    if (!campaign) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/v1/recovery/transactions`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data: TransactionResponse =
        await response.json();

      const transaction =
        data.transactions?.find(
          (item) =>
            item.transaction_id ===
            campaign.transaction_id
        );

      if (!transaction) {
        return;
      }

      const normalizedCampaign =
        toRecoveryCase(transaction);

      if (normalizedCampaign) {
        setCampaign(normalizedCampaign);
      }

      setTransactionId(
        transaction.transaction_id
      );

      if (
        transaction.transaction_status ===
          "recovered" ||
        normalizedCampaign?.status ===
          "executed_success"
      ) {
        setStage("executed");

        setRecoveredAmount(
          transaction.amount
        );
      }

      if (
        transaction.transaction_status ===
          "recovery_failed" ||
        normalizedCampaign?.status ===
          "executed_failed"
      ) {
        setStage("failed");

        setRecoveredAmount(0);
      }
    } catch (err) {
      console.error(err);
    }
  }

  /* ============================================================
     RESET
  ============================================================ */

  function resetDemo() {
    setStage("idle");
    setCampaign(null);
    setResult(null);
    setTransactionId(null);
    setRecoveredAmount(null);
    setOutcome("success");
    clearMessages();
  }

  /* ============================================================
     BACKEND HEALTH
  ============================================================ */

  const checkBackend = useCallback(
    async () => {
      try {
        const response = await fetch(
          `${API_URL}/health`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          setError(
            "RecoverAI backend is not healthy."
          );
        }
      } catch {
        setError(
          "Unable to connect to RecoverAI backend."
        );
      }
    },
    []
  );

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  /* ============================================================
     PAGE
  ============================================================ */

  return (
    <section className="min-h-screen bg-[#020617] text-white">

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">

        {/* HEADER */}

        <div className="flex flex-col gap-5 border-b border-slate-800/70 pb-7 md:flex-row md:items-end md:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-cyan-400" />

              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
                RecoverAI / Demonstration
              </p>

            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Recovery Simulator
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Simulate a failed payment and watch
              RecoverAI analyze, govern, approve,
              and execute the recovery decision.
            </p>

          </div>

          <div className="flex items-center gap-3">

            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Demo Mode
            </span>

            <button
              onClick={resetDemo}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Reset
            </button>

          </div>

        </div>

        {/* ALERTS */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 px-5 py-4">

            <div className="flex gap-3">

              <span className="text-red-400">
                !
              </span>

              <div>

                <p className="text-sm font-semibold text-red-300">
                  Something went wrong
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

              <p className="text-sm text-emerald-300">
                {message}
              </p>

            </div>

          </div>
        )}

        {/* SIMULATOR + FLOW */}

        <div className="mt-7 grid gap-6 lg:grid-cols-3">

          {/* PAYMENT FORM */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Step 01
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Simulate Failed Payment
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Send a realistic payment failure event
              into the RecoverAI engine.
            </p>

            {/* CUSTOMER */}

            <div className="mt-7">

              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Customer
              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">

                <Input
                  label="Name"
                  value={customerName}
                  onChange={setCustomerName}
                  placeholder="Customer name"
                />

                <Input
                  label="Email"
                  value={customerEmail}
                  onChange={setCustomerEmail}
                  placeholder="Customer email"
                  type="email"
                />

                <Input
                  label="Phone"
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  placeholder="Phone number"
                />

              </div>

            </div>

            {/* PAYMENT */}

            <div className="mt-7">

              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Payment
              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">

                <Input
                  label="Amount"
                  value={amount}
                  onChange={setAmount}
                  placeholder="10000"
                  type="number"
                />

                <Select
                  label="Payment Method"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={[
                    ["card", "Card"],
                    ["upi", "UPI"],
                    [
                      "bank_transfer",
                      "Bank Transfer",
                    ],
                  ]}
                />

                <div className="sm:col-span-2">

                  <Select
                    label="Failure Reason"
                    value={failureReason}
                    onChange={setFailureReason}
                    options={[
                      [
                        "insufficient_funds",
                        "Insufficient Funds",
                      ],
                      [
                        "card_declined",
                        "Card Declined",
                      ],
                      [
                        "expired_card",
                        "Expired Card",
                      ],
                      [
                        "network_error",
                        "Network Error",
                      ],
                      [
                        "unexpected_processing_error",
                        "Unexpected Processing Error",
                      ],
                    ]}
                  />

                </div>

              </div>

            </div>

            <button
              onClick={simulatePaymentFailure}
              disabled={loading}
              className="mt-7 w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : "Simulate Payment Failure"}
            </button>

          </div>

          {/* FLOW */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Live Flow
            </p>

            <h2 className="mt-1 text-lg font-semibold text-white">
              Recovery Pipeline
            </h2>

            <div className="mt-7 space-y-5">

              <FlowStep
                number="01"
                label="Payment Failure"
                active={stage !== "idle"}
                complete={
                  stage !== "idle" &&
                  stage !== "processing"
                }
              />

              <FlowLine />

              <FlowStep
                number="02"
                label="AI Decision"
                active={campaign !== null}
                complete={campaign !== null}
              />

              <FlowLine />

              <FlowStep
                number="03"
                label="Human Governance"
                active={
                  stage === "review" ||
                  stage === "approved" ||
                  stage === "rejected"
                }
                complete={
                  stage === "approved" ||
                  stage === "rejected"
                }
              />

              <FlowLine />

              <FlowStep
                number="04"
                label="Recovery Execution"
                active={
                  stage === "approved" ||
                  (stage === "processing" &&
                    campaign !== null &&
                    campaign.requires_human_approval === false &&
                    campaign.strategy !== "human_review") ||
                  stage === "executed" ||
                  stage === "failed"
                }
                complete={
                  stage === "executed" ||
                  stage === "failed"
                }
              />

            </div>

          </div>

        </div>

        {/* AI DECISION */}

        {campaign && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80">

            <div className="border-b border-slate-800 px-6 py-5">

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Step 02
              </p>

              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <h2 className="text-xl font-semibold text-white">
                    AI Recovery Decision
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Campaign #{campaign.campaign_id}
                    {" · "}
                    Transaction #
                    {campaign.transaction_id}
                  </p>

                </div>

                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  {strategyLabel(
                    campaign.strategy
                  )}
                </span>

              </div>

            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-3">

              <div>

                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                  Strategy
                </p>

                <p className="mt-3 text-2xl font-semibold text-cyan-300">
                  {strategyLabel(
                    campaign.strategy
                  )}
                </p>

              </div>

              <div>

                <div className="flex items-center justify-between">

                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                    AI Confidence
                  </p>

                  <span className="text-sm font-semibold text-white">
                    {confidencePercent(
                      campaign.confidence
                    )}
                    %
                  </span>

                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">

                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-700"
                    style={{
                      width: `${confidencePercent(
                        campaign.confidence
                      )}%`,
                    }}
                  />

                </div>

              </div>

              <div>

                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                  Payment Value
                </p>

                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatCurrency(
                    campaign.amount
                  )}
                </p>

              </div>

            </div>

            <div className="mx-6 mb-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5">

              <div className="flex items-center gap-2">

                <span className="text-cyan-400">
                  ✦
                </span>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Why RecoverAI chose this
                </p>

              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {campaign.reason}
              </p>

            </div>

          </div>
        )}

        {/* HUMAN GOVERNANCE */}

        {campaign &&
          stage === "review" && (
            <div className="mt-6 rounded-2xl border border-amber-900/50 bg-slate-900/80">

              <div className="border-b border-slate-800 px-6 py-5">

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                  Step 03
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  Human Governance Required
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  RecoverAI has intentionally blocked
                  automated execution for this decision.
                </p>

              </div>

              <div className="p-6">

                <div className="flex gap-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-5">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    ⚠
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-amber-300">
                      Automated recovery blocked
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-400/70">
                      A human must explicitly authorize
                      this recovery campaign before it
                      can be executed.
                    </p>

                  </div>

                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

                  <button
                    onClick={() =>
                      performAction("reject")
                    }
                    disabled={loading}
                    className="rounded-xl border border-red-900/50 bg-red-950/20 px-6 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-950/40 disabled:opacity-50"
                  >
                    {loading
                      ? "Processing..."
                      : "Reject Recovery"}
                  </button>

                  <button
                    onClick={() =>
                      performAction("approve")
                    }
                    disabled={loading}
                    className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                  >
                    {loading
                      ? "Processing..."
                      : "Approve Recovery"}
                  </button>

                </div>

              </div>

            </div>
          )}

        {/* APPROVED */}

        {campaign &&
          stage === "approved" && (
            <div className="mt-6 rounded-2xl border border-emerald-900/40 bg-slate-900/80 p-6">

              <div className="flex gap-4">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  ✓
                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                    Human Approved
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Recovery is authorized
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Campaign #{campaign.campaign_id}
                    can now be executed.
                  </p>

                </div>

              </div>

            </div>
          )}

        {/* EXECUTION */}

        {campaign &&
          (stage === "approved" ||
            (stage === "processing" &&
              campaign.requires_human_approval === false &&
              campaign.strategy !== "human_review")) && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                Step 04
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Execute Recovery
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {stage === "approved"
                  ? "Human approval has authorized this recovery. Record the actual outcome below."
                  : "Policy guardrails approved this recovery for autonomous execution. Record the simulated outcome below."}
              </p>

              {stage === "processing" &&
                campaign.requires_human_approval === false &&
                campaign.strategy !== "human_review" && (
                  <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4">
                    <p className="text-sm font-semibold text-cyan-300">
                      Autonomous recovery authorized
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Gemini proposed the recovery action and RecoverAI's deterministic
                      policy guardrails approved it. No human approval is required.
                    </p>
                  </div>
                )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">

                <Select
                  label="Outcome"
                  value={outcome}
                  onChange={setOutcome}
                  options={[
                    [
                      "success",
                      "Successful Recovery",
                    ],
                    [
                      "failed",
                      "Recovery Failed",
                    ],
                  ]}
                />

                <Input
                  label="Recovered Amount"
                  value={
                    recoveredAmount !== null
                      ? String(recoveredAmount)
                      : String(
                          Number.isFinite(
                            Number(campaign.amount)
                          )
                            ? Number(campaign.amount)
                            : 0
                        )
                  }
                  onChange={(value) => {
                    const numericValue =
                      Number(value);

                    setRecoveredAmount(
                      Number.isFinite(numericValue)
                        ? numericValue
                        : 0
                    );
                  }}
                  type="number"
                />

              </div>

              <button
                onClick={executeRecovery}
                disabled={loading}
                className="mt-5 w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Executing Recovery..."
                  : "Execute Recovery"}
              </button>

            </div>
          )}

        {/* SUCCESS */}

        {stage === "executed" && (
          <div className="mt-6 rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-7">

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">
                  ✓
                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    Recovery Complete
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    Payment successfully recovered
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    The recovery campaign was executed
                    successfully in RecoverAI.
                  </p>

                </div>

              </div>

              <div className="text-left sm:text-right">

                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Recovered Amount
                </p>

                <p className="mt-1 text-3xl font-bold text-emerald-300">
                  {formatCurrency(
                    recoveredAmount ??
                      campaign?.amount ??
                      0
                  )}
                </p>

              </div>

            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">

              <ResultCard
                label="Transaction"
                value={
                  transactionId
                    ? `#${transactionId}`
                    : "Completed"
                }
              />

              <ResultCard
                label="Strategy"
                value={strategyLabel(
                  campaign?.strategy
                )}
              />

              <ResultCard
                label="Status"
                value="Recovered"
              />

            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">

              <a
                href="/transactions"
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                View Transaction
              </a>

              <a
                href="/analytics"
                className="rounded-xl bg-cyan-500 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                View Analytics
              </a>

              <a
                href="/"
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Back to Overview
              </a>

            </div>

          </div>
        )}

        {/* FAILED EXECUTION */}

        {stage === "failed" && (
          <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/10 p-7">

            <div className="flex gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xl text-red-400">
                ×
              </div>

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400">
                  Recovery Failed
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  Recovery was not successful
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  RecoverAI recorded the failed recovery
                  outcome in the transaction and audit
                  records.
                </p>

              </div>

            </div>

            <button
              onClick={resetDemo}
              className="mt-6 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Start New Demo
            </button>

          </div>
        )}

        {/* REJECTED */}

        {stage === "rejected" && (
          <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/10 p-7">

            <div className="flex gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xl text-red-400">
                ×
              </div>

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400">
                  Recovery Rejected
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  Recovery was not executed
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  The human reviewer rejected the
                  recovery decision. RecoverAI preserved
                  the decision in the recovery and audit
                  records.
                </p>

              </div>

            </div>

            <button
              onClick={resetDemo}
              className="mt-6 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Start New Demo
            </button>

          </div>
        )}

        {/* API RESPONSE */}

        {result && (
          <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60">

            <summary className="cursor-pointer px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              View API Event Response
            </summary>

            <pre className="overflow-x-auto border-t border-slate-800 p-6 text-xs leading-6 text-slate-400">
              {JSON.stringify(
                result,
                null,
                2
              )}
            </pre>

          </details>
        )}

      </div>

    </section>
  );
}

/* ================================================================
   INPUT
================================================================ */

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">

      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-500/50"
      />

    </label>
  );
}

/* ================================================================
   SELECT
================================================================ */

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">

      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
      >

        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          )
        )}

      </select>

    </label>
  );
}

/* ================================================================
   FLOW STEP
================================================================ */

function FlowStep({
  number,
  label,
  active,
  complete,
}: {
  number: string;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-3">

      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition ${
          complete
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : active
              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
              : "border-slate-800 bg-slate-950 text-slate-600"
        }`}
      >
        {complete ? "✓" : number}
      </div>

      <div>

        <p
          className={`text-sm font-medium ${
            active
              ? "text-white"
              : "text-slate-600"
          }`}
        >
          {label}
        </p>

        <p className="text-[10px] text-slate-600">
          {complete
            ? "Completed"
            : active
              ? "In progress"
              : "Waiting"}
        </p>

      </div>

    </div>
  );
}

/* ================================================================
   FLOW LINE
================================================================ */

function FlowLine() {
  return (
    <div className="ml-[17px] h-4 border-l border-slate-800" />
  );
}

/* ================================================================
   RESULT CARD
================================================================ */

function ResultCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/10 bg-slate-950/60 p-4">

      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-white">
        {value}
      </p>

    </div>
  );
}