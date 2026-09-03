"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_URL } from "../../lib/api";

type AuditLog = {
  audit_log_id: number;
  event_type: string;
  actor: string | null;
  decision: string | null;
  explanation: string | null;

  campaign_id: number | null;
  strategy: string | null;
  campaign_status: string | null;
  requires_human_approval: boolean | null;
  confidence: number | null;

  transaction_id: number | null;
  payment_id: string | null;
  amount: number | null;
  currency: string | null;
  failure_reason: string | null;
  payment_method: string | null;
  transaction_status: string | null;

  customer: string | null;
  customer_email: string | null;

  input_snapshot: string | null;
  output_snapshot: string | null;

  created_at: string | null;
};

type AuditResponse = {
  count: number;
  logs: AuditLog[];
};

function formatCurrency(
  amount: number | null,
  currency: string | null,
) {
  if (amount === null) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function eventLabel(event: string) {
  switch (event) {
    case "RECOVERY_DECISION":
      return "AI Recovery Decision";

    case "HUMAN_APPROVAL":
      return "Human Approval";

    case "HUMAN_REJECTION":
      return "Human Rejection";

    case "RECOVERY_EXECUTION":
      return "Recovery Execution";

    default:
      return event.replaceAll("_", " ");
  }
}

function eventClass(event: string) {
  switch (event) {
    case "RECOVERY_DECISION":
      return "event-ai";

    case "HUMAN_APPROVAL":
      return "event-approved";

    case "HUMAN_REJECTION":
      return "event-rejected";

    case "RECOVERY_EXECUTION":
      return "event-execution";

    default:
      return "event-default";
  }
}

function decisionClass(decision: string | null) {
  switch (decision) {
    case "success":
    case "approved":
      return "badge-success";

    case "rejected":
    case "failed":
      return "badge-danger";

    case "retry":
      return "badge-warning";

    case "human_review":
      return "badge-review";

    default:
      return "badge-neutral";
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/v1/recovery/audit`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Audit API returned ${response.status}`,
        );
      }

      const data: AuditResponse = await response.json();

      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load audit records. Make sure the RecoverAI backend is running on port 8000.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        String(log.audit_log_id).includes(query) ||
        (log.event_type || "").toLowerCase().includes(query) ||
        (log.actor || "").toLowerCase().includes(query) ||
        (log.decision || "").toLowerCase().includes(query) ||
        (log.customer || "").toLowerCase().includes(query) ||
        (log.payment_id || "").toLowerCase().includes(query) ||
        String(log.campaign_id || "").includes(query);

      let matchesFilter = true;

      if (filter === "ai") {
        matchesFilter =
          log.event_type === "RECOVERY_DECISION";
      }

      if (filter === "human") {
        matchesFilter =
          log.event_type === "HUMAN_APPROVAL" ||
          log.event_type === "HUMAN_REJECTION";
      }

      if (filter === "execution") {
        matchesFilter =
          log.event_type === "RECOVERY_EXECUTION";
      }

      return matchesSearch && matchesFilter;
    });
  }, [logs, search, filter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,

      ai: logs.filter(
        (log) =>
          log.event_type === "RECOVERY_DECISION",
      ).length,

      human: logs.filter(
        (log) =>
          log.event_type === "HUMAN_APPROVAL" ||
          log.event_type === "HUMAN_REJECTION",
      ).length,

      executions: logs.filter(
        (log) =>
          log.event_type === "RECOVERY_EXECUTION",
      ).length,

      successful: logs.filter(
        (log) => log.decision === "success",
      ).length,

      rejected: logs.filter(
        (log) => log.decision === "rejected",
      ).length,
    };
  }, [logs]);

  return (
    <main className="audit-page">
      <div className="audit-container">

        {/* HEADER */}

        <header className="page-header">
          <div>
            <div className="eyebrow">
              RECOVERAI / GOVERNANCE
            </div>

            <h1>Audit & Governance</h1>

            <p>
              Complete decision history for AI recommendations,
              human oversight, and recovery execution.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadAuditLogs}
            disabled={loading}
          >
            ↻ {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {/* STATS */}

        <section className="stats-grid">

          <div className="stat-card">
            <span>Total Events</span>
            <strong>{stats.total}</strong>
            <small>Recorded audit events</small>
          </div>

          <div className="stat-card ai-stat">
            <span>AI Decisions</span>
            <strong>{stats.ai}</strong>
            <small>Gemini recommendations</small>
          </div>

          <div className="stat-card human-stat">
            <span>Human Decisions</span>
            <strong>{stats.human}</strong>
            <small>Approval / rejection events</small>
          </div>

          <div className="stat-card execution-stat">
            <span>Executions</span>
            <strong>{stats.executions}</strong>
            <small>Recovery actions executed</small>
          </div>

        </section>

        {/* CONTROLS */}

        <section className="toolbar">

          <div className="search-box">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search customer, payment, campaign, actor..."
            />
          </div>

          <div className="filters">

            <button
              className={
                filter === "all"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("all")}
            >
              All
            </button>

            <button
              className={
                filter === "ai"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("ai")}
            >
              AI Decisions
            </button>

            <button
              className={
                filter === "human"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("human")}
            >
              Human Review
            </button>

            <button
              className={
                filter === "execution"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("execution")}
            >
              Executions
            </button>

          </div>

        </section>

        {/* ERROR */}

        {error && (
          <div className="error-box">
            <strong>Connection problem</strong>
            <span>{error}</span>

            <button onClick={loadAuditLogs}>
              Try again
            </button>
          </div>
        )}

        {/* CONTENT */}

        <section className="audit-panel">

          <div className="panel-header">
            <div>
              <h2>Decision Timeline</h2>

              <p>
                {filteredLogs.length} of {logs.length} events
                displayed
              </p>
            </div>

            <div className="live-status">
              <span className="live-dot" />
              Live audit stream
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loader" />
              <p>Loading audit records...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◌</div>
              <h3>No audit events found</h3>
              <p>
                Try changing your search or filter.
              </p>
            </div>
          ) : (
            <div className="timeline">

              {filteredLogs.map((log) => {
                const isExpanded =
                  expanded === log.audit_log_id;

                return (
                  <article
                    className="timeline-item"
                    key={log.audit_log_id}
                  >

                    <div
                      className={`timeline-marker ${eventClass(
                        log.event_type,
                      )}`}
                    >
                      {log.event_type ===
                        "RECOVERY_DECISION" && "AI"}

                      {log.event_type ===
                        "HUMAN_APPROVAL" && "✓"}

                      {log.event_type ===
                        "HUMAN_REJECTION" && "×"}

                      {log.event_type ===
                        "RECOVERY_EXECUTION" && "↗"}
                    </div>

                    <div className="timeline-content">

                      <div className="event-top">

                        <div>
                          <div className="event-title-row">

                            <h3>
                              {eventLabel(
                                log.event_type,
                              )}
                            </h3>

                            {log.decision && (
                              <span
                                className={`badge ${decisionClass(
                                  log.decision,
                                )}`}
                              >
                                {log.decision.replaceAll(
                                  "_",
                                  " ",
                                )}
                              </span>
                            )}

                          </div>

                          <div className="event-meta">
                            Event #{log.audit_log_id}
                            {" · "}
                            {formatDate(log.created_at)}
                          </div>
                        </div>

                        <button
                          className="details-button"
                          onClick={() =>
                            setExpanded(
                              isExpanded
                                ? null
                                : log.audit_log_id,
                            )
                          }
                        >
                          {isExpanded
                            ? "Hide details"
                            : "View details"}
                          <span>
                            {isExpanded ? "↑" : "↓"}
                          </span>
                        </button>

                      </div>

                      <div className="event-summary">

                        <div>
                          <span className="label">
                            Actor
                          </span>

                          <strong>
                            {log.actor || "—"}
                          </strong>
                        </div>

                        <div>
                          <span className="label">
                            Customer
                          </span>

                          <strong>
                            {log.customer || "—"}
                          </strong>
                        </div>

                        <div>
                          <span className="label">
                            Campaign
                          </span>

                          <strong>
                            {log.campaign_id
                              ? `#${log.campaign_id}`
                              : "—"}
                          </strong>
                        </div>

                        <div>
                          <span className="label">
                            Amount
                          </span>

                          <strong>
                            {formatCurrency(
                              log.amount,
                              log.currency,
                            )}
                          </strong>
                        </div>

                      </div>

                      {log.explanation && (
                        <div className="explanation">
                          <span>Decision rationale</span>
                          <p>{log.explanation}</p>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="details-panel">

                          <div className="details-grid">

                            <div>
                              <span>Transaction</span>
                              <strong>
                                {log.transaction_id
                                  ? `#${log.transaction_id}`
                                  : "—"}
                              </strong>
                            </div>

                            <div>
                              <span>Payment ID</span>
                              <strong>
                                {log.payment_id || "—"}
                              </strong>
                            </div>

                            <div>
                              <span>Strategy</span>
                              <strong>
                                {log.strategy || "—"}
                              </strong>
                            </div>

                            <div>
                              <span>Campaign Status</span>
                              <strong>
                                {log.campaign_status ||
                                  "—"}
                              </strong>
                            </div>

                            <div>
                              <span>Transaction Status</span>
                              <strong>
                                {log.transaction_status ||
                                  "—"}
                              </strong>
                            </div>

                            <div>
                              <span>Failure Reason</span>
                              <strong>
                                {log.failure_reason ||
                                  "—"}
                              </strong>
                            </div>

                            <div>
                              <span>Payment Method</span>
                              <strong>
                                {log.payment_method ||
                                  "—"}
                              </strong>
                            </div>

                            <div>
                              <span>AI Confidence</span>
                              <strong>
                                {log.confidence !== null
                                  ? `${Math.round(
                                      log.confidence * 100,
                                    )}%`
                                  : "—"}
                              </strong>
                            </div>

                          </div>

                          <div className="snapshot-section">

                            <div className="snapshot">
                              <div className="snapshot-title">
                                Input Snapshot
                              </div>

                              <pre>
                                {log.input_snapshot ||
                                  "No input snapshot recorded."}
                              </pre>
                            </div>

                            <div className="snapshot">
                              <div className="snapshot-title">
                                Output Snapshot
                              </div>

                              <pre>
                                {log.output_snapshot ||
                                  "No output snapshot recorded."}
                              </pre>
                            </div>

                          </div>

                        </div>
                      )}

                    </div>

                  </article>
                );
              })}

            </div>
          )}

        </section>

        {/* FOOTER */}

        <footer className="audit-footer">
          <div>
            <span className="shield">◆</span>
            RecoverAI Audit Integrity
          </div>

          <span>
            Every AI decision and human intervention is recorded.
          </span>
        </footer>

      </div>

      <style jsx>{`
  .audit-page {
    min-height: 100vh;
    background: #020617;
    color: #e5e7eb;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  .audit-container {
    width: min(1380px, calc(100% - 48px));
    margin: 0 auto;
    padding: 42px 0 36px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 30px;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: #22d3ee;
    margin-bottom: 10px;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 44px);
    line-height: 1.05;
    letter-spacing: -0.04em;
    color: #f8fafc;
  }

  .page-header p {
    margin: 12px 0 0;
    max-width: 680px;
    color: #7f93b2;
    font-size: 14px;
    line-height: 1.6;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }

  .stat-card {
    background: #101a2d;
    border: 1px solid #22314a;
    border-radius: 15px;
    padding: 20px;
  }

  .stat-card span {
    display: block;
    color: #8ca3c2;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .stat-card strong {
    display: block;
    margin-top: 9px;
    color: #f8fafc;
    font-size: 30px;
  }

  .ai-stat strong {
    color: #22d3ee;
  }

  .human-stat strong {
    color: #a78bfa;
  }

  .execution-stat strong {
    color: #34d399;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
  }

  .search-box {
    flex: 1;
    max-width: 520px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #0b1425;
    border: 1px solid #253650;
    border-radius: 11px;
    padding: 0 14px;
  }

  .search-box input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    padding: 13px 0;
    color: #e5e7eb;
    font-size: 13px;
  }

  .filters {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .filter {
    border: 1px solid #293a55;
    background: #0d1728;
    color: #8ea3bf;
    border-radius: 9px;
    padding: 9px 12px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .filter.active {
    background: #17243a;
    color: #22d3ee;
    border-color: #22d3ee;
  }

  .audit-panel {
    overflow: hidden;
    background: #0b1425;
    border: 1px solid #22314a;
    border-radius: 17px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 21px 25px;
    border-bottom: 1px solid #1d2a40;
    background: #0d1728;
  }

  .panel-header h2 {
    margin: 0;
    color: #f1f5f9;
    font-size: 17px;
  }

  .panel-header p {
    margin: 4px 0 0;
    color: #617895;
    font-size: 11px;
  }

  .live-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #7f93ae;
    font-size: 11px;
    font-weight: 700;
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 4px rgba(16,185,129,.1);
  }

  .timeline {
    padding: 8px 25px 24px;
  }

  .timeline-item {
    display: flex;
    gap: 17px;
    padding: 23px 0;
    border-bottom: 1px solid #1c293d;
  }

  .timeline-item:last-child {
    border-bottom: 0;
  }

  .timeline-marker {
    flex: 0 0 38px;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    font-size: 9px;
    font-weight: 900;
    border: 1px solid #293a55;
    background: #111d31;
    color: #7890ad;
  }

  .event-ai {
    background: rgba(34,211,238,.08);
    color: #22d3ee;
    border-color: rgba(34,211,238,.25);
  }

  .event-approved {
    background: rgba(16,185,129,.09);
    color: #34d399;
    border-color: rgba(16,185,129,.25);
  }

  .event-rejected {
    background: rgba(239,68,68,.09);
    color: #f87171;
    border-color: rgba(239,68,68,.25);
  }

  .event-execution {
    background: rgba(139,92,246,.09);
    color: #a78bfa;
    border-color: rgba(139,92,246,.25);
  }

  .timeline-content {
    min-width: 0;
    flex: 1;
  }

  .event-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .event-title-row {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .event-title-row h3 {
    margin: 0;
    color: #e5edf7;
    font-size: 14px;
  }

  .event-meta {
    margin-top: 5px;
    color: #617895;
    font-size: 10px;
  }

  .badge {
    display: inline-flex;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    border: 1px solid transparent;
  }

  .badge-success {
    color: #34d399;
    background: rgba(16,185,129,.1);
  }

  .badge-danger {
    color: #f87171;
    background: rgba(239,68,68,.1);
  }

  .badge-warning {
    color: #fbbf24;
    background: rgba(245,158,11,.1);
  }

  .badge-review {
    color: #c4b5fd;
    background: rgba(139,92,246,.1);
  }

  .badge-neutral {
    color: #94a3b8;
    background: #172235;
  }

  .details-button {
    border: 1px solid transparent;
    background: transparent;
    color: #7187a3;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 7px;
  }

  .details-button:hover {
    color: #22d3ee;
    background: rgba(34,211,238,.05);
  }

  .event-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 16px;
    margin-top: 17px;
    padding: 14px 16px;
    background: #0f1a2c;
    border: 1px solid #1f2e45;
    border-radius: 10px;
  }

  .event-summary .label {
    display: block;
    color: #58708f;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .event-summary strong {
    display: block;
    margin-top: 4px;
    color: #dbe7f5;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .explanation {
    margin-top: 13px;
  }

  .explanation span {
    color: #58708f;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .explanation p {
    margin: 5px 0 0;
    color: #8095b0;
    font-size: 12px;
    line-height: 1.55;
  }

  .details-panel {
    margin-top: 17px;
    padding: 18px;
    background: #08111f;
    border: 1px solid #203049;
    border-radius: 12px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 16px;
  }

  .details-grid span {
    display: block;
    color: #58708f;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .details-grid strong {
    display: block;
    margin-top: 4px;
    color: #cbd8e8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .snapshot-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 20px;
  }

  .snapshot-title {
    margin-bottom: 7px;
    color: #66809f;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .snapshot pre {
    margin: 0;
    padding: 13px;
    min-height: 80px;
    max-height: 230px;
    overflow: auto;
    border: 1px solid #263852;
    border-radius: 8px;
    background: #020617;
    color: #a8c0dc;
    font-family: Consolas, monospace;
    font-size: 10px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .empty-state {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #607895;
  }

  .loader {
    width: 28px;
    height: 28px;
    border: 3px solid #243650;
    border-top-color: #22d3ee;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .audit-footer {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 3px;
    color: #536b88;
    font-size: 11px;
  }

  .audit-footer div {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #7187a3;
    font-weight: 700;
  }

  .shield {
    color: #22d3ee;
  }

  @media (max-width: 950px) {
    .stats-grid {
      grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .search-box {
      max-width: none;
    }

    .filters {
      justify-content: flex-start;
    }

    .event-summary,
    .details-grid {
      grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .snapshot-section {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 650px) {
    .audit-container {
      width: calc(100% - 24px);
      padding-top: 28px;
    }

    .page-header {
      flex-direction: column;
    }

    .refresh-button {
      width: 100%;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .panel-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .timeline {
      padding-left: 14px;
      padding-right: 14px;
    }

    .timeline-item {
      gap: 11px;
    }

    .timeline-marker {
      flex-basis: 32px;
      width: 32px;
      height: 32px;
    }

    .event-top {
      flex-direction: column;
    }

    .event-summary,
    .details-grid {
      grid-template-columns: 1fr 1fr;
    }

    .audit-footer {
      flex-direction: column;
    }
  }
`}</style>
    </main>
  );
}
