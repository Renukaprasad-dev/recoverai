RecoverAI

Autonomous AI-Powered Revenue Recovery System

RecoverAI is an AI-powered revenue recovery platform that detects failed payments, diagnoses why they failed, selects a policy-compliant recovery strategy, executes safe recovery actions, and records every decision in an auditable trail.

Built for the Razorpay AI Buildathon — AI Revenue Recovery track.

🚨 The Problem

Failed payments directly translate into lost revenue.

Traditional payment recovery systems often rely on:

Fixed retry schedules

Generic customer messages

Manual investigation

One-size-fits-all recovery rules

Limited visibility into why a recovery action was chosen

RecoverAI turns payment recovery into an intelligent, policy-bounded decision system.

Instead of simply retrying every failed payment, RecoverAI asks:

Why did the payment fail, what is the safest recovery action, and should AI act automatically or involve a human?

🤖 What RecoverAI Does

RecoverAI processes the complete recovery lifecycle:

Payment Failure
      ↓
Webhook Ingestion
      ↓
Failure Diagnosis
      ↓
Customer History
      ↓
Gemini AI Decision
      ↓
Policy Guardrails
      ↓
+-----------------------+
│                       │
Automatic Action    Human Review
│                       │
└──────────┬────────────┘
           ↓
      Recovery Execution
           ↓
   Revenue Recovered
           ↓
      Audit Trail
           ↓
       Analytics

🧠 AI Decision Engine

RecoverAI uses Google Gemini to generate a structured recovery recommendation.

The AI considers factors such as:

Payment failure reason

Payment amount

Payment method

Customer history

Previous payment failures

Previous recovery activity

Recovery confidence

The AI produces a structured decision containing:

Recovery strategy

Reasoning

Retry delay

Discount percentage

Human approval requirement

Confidence score

Example:

{
  "strategy": "retry",
  "reason": "The failure is potentially temporary and a retry is recommended.",
  "retry_after_minutes": 1440,
  "discount_percent": 0,
  "requires_human_approval": false,
  "confidence": 0.95
}

AI Does Not Have Unlimited Authority

A core design principle of RecoverAI is:

Gemini recommends. Policy guardrails authorize.

The AI decision is validated by a deterministic recovery policy engine before execution.

Guardrails enforce constraints such as:

Maximum retry delay

Maximum discount

Minimum confidence

Failure-specific recovery strategies

Human review for unknown or high-risk failures

Human review when AI confidence is insufficient

Safe handling of invalid AI output

This prevents an AI model from directly making unrestricted financial actions.

⚡ Automatic Recovery

For eligible failures, RecoverAI can automatically execute an approved recovery strategy.

Example:

Failed Payment
₹7,500
Insufficient Funds
        ↓
Gemini
Retry recommended
95% confidence
        ↓
Policy Validation
Approved
        ↓
Automatic Recovery
        ↓
₹7,500 Recovered

👤 Human-in-the-Loop Recovery

RecoverAI also supports human governance.

For unexpected, unknown, high-risk, or insufficient-confidence failures:

Failed Payment
₹45,000
Unexpected Processing Error
        ↓
AI / Policy Evaluation
        ↓
Human Review Required
        ↓
Approval
        ↓
Recovery Execution
        ↓
₹45,000 Recovered

Humans can:

Review recovery campaigns

Approve actions

Reject actions

Execute approved campaigns

Inspect the audit history

Webhook Security

RecoverAI is designed around secure payment webhook processing.

The backend supports:

Raw request body signature validation

HMAC-SHA256 webhook verification

Razorpay event ID based deduplication

Fast webhook acknowledgement

Asynchronous recovery processing

Safe handling of repeated webhook deliveries

The webhook flow is designed so that duplicate payment events do not accidentally trigger duplicate recovery actions.

📊 Analytics

RecoverAI provides a recovery control center with system-wide metrics including:

Failed payment count

Failed payment value

Recovery campaigns

Successful recoveries

Recovered revenue

Recovery rate

Human approvals

Human rejections

Pending human reviews

Recent recovery activity

The dashboard separates headline system totals from recent activity views so the metrics remain clear and auditable.

Audit Trail

Every important recovery event is recorded.

The audit system tracks events such as:

AI recovery decisions

Human approvals

Human rejections

Recovery executions

Execution outcomes

Each event can be associated with the relevant transaction and recovery campaign.

This creates an explainable trail from:

Payment Failure
      ↓
AI Decision
      ↓
Policy Validation
      ↓
Human Approval (if required)
      ↓
Execution
      ↓
Recovery Outcome

Architecture

                         +---------------------+
                         │      Razorpay       │
                         │  payment.failed    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         +---------------------+
                         │   FastAPI Backend   │
                         │ Webhook Verification│
                         └──────────┬──────────┘
                                    │
                                    ▼
                         +---------------------+
                         │ Customer History    │
                         │ + Transaction Data  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         +---------------------+
                         │    Gemini AI        │
                         │ Recovery Decision   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         +---------------------+
                         │ Policy Guardrails   │
                         │ Deterministic Rules │
                         └──────────┬──────────┘
                                    │
                         +---------------------+
                         ▼                     ▼
                +----------------+    +----------------+
                │ Auto Recovery  │    │ Human Review   │
                └────────┬───────┘    └───────┬────────┘
                         │                    │
                         └─────────┬──────────┘
                                   ▼
                         +---------------------+
                         │ Recovery Execution  │
                         └──────────┬──────────┘
                                    │
                         +---------------------+
                         ▼                     ▼
                  +-------------+       +-------------+
                  │ PostgreSQL  │       │ Audit Logs  │
                  │  Database   │       │             │
                  └─────────────┘       └─────────────┘
                                   
                                    │
                                    ▼
                         +---------------------+
                         │ Next.js Dashboard   │
                         │ Analytics / Audit   │
                         └─────────────────────┘

🧰 Technology Stack

Frontend

Next.js 16

React

TypeScript

Tailwind CSS

Lucide Icons

Supabase Authentication

Backend

Python

FastAPI

SQLAlchemy

PostgreSQL

Pydantic

Async processing

AI

Google Gemini

Structured JSON/Pydantic output

Deterministic policy validation

Infrastructure

Vercel — production frontend + FastAPI backend

Supabase PostgreSQL — production database

Render — preserved fallback backend

Project Structure

recoverai/
│
├── backend/
│   ├── ai_models.py
│   ├── analytics.py
│   ├── customer_history.py
│   ├── database.py
│   ├── gemini_agent.py
│   ├── init_db.py
│   ├── main.py
│   ├── models.py
│   ├── recovery.py
│   ├── recovery_engine.py
│   ├── webhooks.py
│   ├── test_gemini.py
│   ├── test_policy.py
│   ├── test_recovery.py
│   └── .gitignore
│
├── frontend/
│   ├── app/
│   │   ├── analytics/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── demo/
│   │   ├── login/
│   │   ├── recovery/
│   │   ├── transactions/
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── supabase-server.ts
│   │
│   └── proxy.ts
│
├── test-gemini-payment.json
├── test-payment.json
└── .gitignore

Authentication

RecoverAI uses Supabase Authentication with Google OAuth.

The application includes:

Google sign-in

Secure OAuth callback

Session management

Protected application routes

Logout

Authenticated user display

Unauthenticated users are redirected to the login screen.

🧪 Demo Scenarios

RecoverAI includes a built-in demo simulator designed to demonstrate the complete recovery lifecycle.

Scenario 1 — Automatic Recovery

Customer
    ↓
Payment Failed
    ↓
Insufficient Funds
    ↓
Gemini recommends Retry
    ↓
Policy approves
    ↓
Automatic execution
    ↓
Revenue recovered

Scenario 2 — Human Review

Customer
    ↓
Payment Failed
    ↓
Unexpected Processing Error
    ↓
Human review required
    ↓
Operator approves
    ↓
Recovery execution
    ↓
Revenue recovered

These scenarios demonstrate both autonomous execution and human governance.

🚀 Local Development

1. Clone the repository

git clone https://github.com/Renukaprasad-dev/recoverai.git
cd recoverai

2. Backend setup

cd backend
python -m venv .venv

Windows:

.\.venv\Scripts\Activate.ps1

Install dependencies:

pip install -r requirements.txt

Create:

backend/.env

with your local database and Gemini configuration.

3. Initialize the database

From the project root:

python -m backend.init_db

4. Start the backend

From the project root:

python -m uvicorn backend.main:app --reload --port 8000

Backend:

http://localhost:8000

5. Frontend setup

Open another terminal:

cd frontend
npm install
npm run dev

Frontend:

http://localhost:3000

Environment Variables

Backend

DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=postgres
GEMINI_API_KEY=

Frontend

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

Never commit real secrets to GitHub.

🧪 Testing

The backend includes tests for:

Gemini recovery decisions

Recovery policy validation

Recovery engine behavior

Example:

python -m backend.test_gemini
python -m backend.test_policy
python -m backend.test_recovery

🎯 Design Principles

RecoverAI is built around five principles:

1. AI-first diagnosis

Use AI to understand payment failures instead of relying only on static rules.

2. Deterministic safety

AI recommendations are validated against explicit policy constraints before execution.

3. Autonomous when safe

Low-risk, high-confidence recovery actions can execute automatically.

4. Human when necessary

Uncertain, unknown, or high-risk situations are escalated to humans.

5. Everything is auditable

Recovery decisions and outcomes are recorded so the system can explain what happened.

💰 The Core Metric

The most important outcome is not the number of AI decisions.

It is:

Revenue recovered from failed payments.

RecoverAI therefore tracks the complete journey from failed payment value to successfully recovered revenue.

Buildathon Demo

The recommended demonstration flow is:

1. Login
      ↓
2. Show failed payment
      ↓
3. Trigger recovery simulation
      ↓
4. Gemini diagnoses failure
      ↓
5. Policy guardrail validates decision
      ↓
6. Automatic recovery
      ↓
7. Show recovered revenue
      ↓
8. Trigger human-review scenario
      ↓
9. Approve recovery
      ↓
10. Execute recovery
      ↓
11. Show Analytics
      ↓
12. Show Audit Trail

The demo is designed to show that RecoverAI is not simply an AI chatbot — it is an end-to-end revenue recovery system.

🔒 Security Notes

Never commit:

.env

.env.local

API keys

Database passwords

OAuth client secrets

Private credentials

Production webhook secrets

Environment files are excluded through .gitignore.

📌 Project Status

Completed

Payment failure webhook processing

Webhook signature validation

Event deduplication

Customer history

Gemini AI recovery decisions

Structured AI output

Deterministic policy guardrails

Automatic recovery

Human approval workflow

Recovery execution

Analytics dashboard

Audit trail

Google authentication

Protected routes

Demo simulator

GitHub repository

Next

Production deployment

Demo video

Final buildathon submission

Author

Renukaprasad-dev

Built for the Razorpay AI Buildathon.

Why RecoverAI?

RecoverAI combines:

AI reasoning + deterministic safety + autonomous execution + human governance + measurable revenue recovery

into one system.

The goal is simple:

Turn failed payments into recovered revenue — safely and intelligently.

Production Demo

Live application: https://recoverai-taupe.vercel.app

The production deployment has been verified on both desktop and mobile.

