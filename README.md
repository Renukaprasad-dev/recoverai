# RecoverAI

### Autonomous AI-Powered Revenue Recovery System

RecoverAI is an AI-powered revenue recovery platform that detects failed payments, diagnoses why they failed, selects a policy-compliant recovery strategy, executes safe recovery actions, and records every decision in an auditable trail.

Built for the **Razorpay AI Buildathon â€” AI Revenue Recovery** track.

---

## ðŸš¨ The Problem

Failed payments directly translate into lost revenue.

Traditional payment recovery systems often rely on:

- Fixed retry schedules
- Generic customer messages
- Manual investigation
- One-size-fits-all recovery rules
- Limited visibility into why a recovery action was chosen

RecoverAI turns payment recovery into an **intelligent, policy-bounded decision system**.

Instead of simply retrying every failed payment, RecoverAI asks:

> **Why did the payment fail, what is the safest recovery action, and should AI act automatically or involve a human?**

---

## ðŸ¤– What RecoverAI Does

RecoverAI processes the complete recovery lifecycle:

```text
Payment Failure
      â†“
Webhook Ingestion
      â†“
Failure Diagnosis
      â†“
Customer History
      â†“
Gemini AI Decision
      â†“
Policy Guardrails
      â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                       â”‚
Automatic Action    Human Review
â”‚                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â†“
      Recovery Execution
           â†“
   Revenue Recovered
           â†“
      Audit Trail
           â†“
       Analytics
```

---

## ðŸ§  AI Decision Engine

RecoverAI uses **Google Gemini** to generate a structured recovery recommendation.

The AI considers factors such as:

- Payment failure reason
- Payment amount
- Payment method
- Customer history
- Previous payment failures
- Previous recovery activity
- Recovery confidence

The AI produces a structured decision containing:

- Recovery strategy
- Reasoning
- Retry delay
- Discount percentage
- Human approval requirement
- Confidence score

Example:

```json
{
  "strategy": "retry",
  "reason": "The failure is potentially temporary and a retry is recommended.",
  "retry_after_minutes": 1440,
  "discount_percent": 0,
  "requires_human_approval": false,
  "confidence": 0.95
}
```

---

## ðŸ›¡ï¸ AI Does Not Have Unlimited Authority

A core design principle of RecoverAI is:

> **Gemini recommends. Policy guardrails authorize.**

The AI decision is validated by a deterministic recovery policy engine before execution.

Guardrails enforce constraints such as:

- Maximum retry delay
- Maximum discount
- Minimum confidence
- Failure-specific recovery strategies
- Human review for unknown or high-risk failures
- Human review when AI confidence is insufficient
- Safe handling of invalid AI output

This prevents an AI model from directly making unrestricted financial actions.

---

## âš¡ Automatic Recovery

For eligible failures, RecoverAI can automatically execute an approved recovery strategy.

Example:

```text
Failed Payment
â‚¹7,500
Insufficient Funds
        â†“
Gemini
Retry recommended
95% confidence
        â†“
Policy Validation
Approved
        â†“
Automatic Recovery
        â†“
â‚¹7,500 Recovered
```

---

## ðŸ‘¤ Human-in-the-Loop Recovery

RecoverAI also supports human governance.

For unexpected, unknown, high-risk, or insufficient-confidence failures:

```text
Failed Payment
â‚¹45,000
Unexpected Processing Error
        â†“
AI / Policy Evaluation
        â†“
Human Review Required
        â†“
Approval
        â†“
Recovery Execution
        â†“
â‚¹45,000 Recovered
```

Humans can:

- Review recovery campaigns
- Approve actions
- Reject actions
- Execute approved campaigns
- Inspect the audit history

---

## ðŸ” Webhook Security

RecoverAI is designed around secure payment webhook processing.

The backend supports:

- Raw request body signature validation
- HMAC-SHA256 webhook verification
- Razorpay event ID based deduplication
- Fast webhook acknowledgement
- Asynchronous recovery processing
- Safe handling of repeated webhook deliveries

The webhook flow is designed so that duplicate payment events do not accidentally trigger duplicate recovery actions.

---

## ðŸ“Š Analytics

RecoverAI provides a recovery control center with system-wide metrics including:

- Failed payment count
- Failed payment value
- Recovery campaigns
- Successful recoveries
- Recovered revenue
- Recovery rate
- Human approvals
- Human rejections
- Pending human reviews
- Recent recovery activity

The dashboard separates headline system totals from recent activity views so the metrics remain clear and auditable.

---

## ðŸ” Audit Trail

Every important recovery event is recorded.

The audit system tracks events such as:

- AI recovery decisions
- Human approvals
- Human rejections
- Recovery executions
- Execution outcomes

Each event can be associated with the relevant transaction and recovery campaign.

This creates an explainable trail from:

```text
Payment Failure
      â†“
AI Decision
      â†“
Policy Validation
      â†“
Human Approval (if required)
      â†“
Execution
      â†“
Recovery Outcome
```

---

## ðŸ—ï¸ Architecture

```text
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚      Razorpay       â”‚
                         â”‚  payment.failed    â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                                    â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚   FastAPI Backend   â”‚
                         â”‚ Webhook Verificationâ”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                                    â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚ Customer History    â”‚
                         â”‚ + Transaction Data  â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                                    â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚    Gemini AI        â”‚
                         â”‚ Recovery Decision   â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                                    â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚ Policy Guardrails   â”‚
                         â”‚ Deterministic Rules â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â–¼                     â–¼
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚ Auto Recovery  â”‚    â”‚ Human Review   â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚                    â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚ Recovery Execution  â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â–¼                     â–¼
                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                  â”‚ PostgreSQL  â”‚       â”‚ Audit Logs  â”‚
                  â”‚  Database   â”‚       â”‚             â”‚
                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   
                                    â”‚
                                    â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚ Next.js Dashboard   â”‚
                         â”‚ Analytics / Audit   â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ§° Technology Stack

### Frontend

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Lucide Icons
- Supabase Authentication

### Backend

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- Async processing

### AI

- Google Gemini
- Structured JSON/Pydantic output
- Deterministic policy validation

### Infrastructure

- Vercel — production frontend + FastAPI backend
- Supabase PostgreSQL — production database
- Render — preserved fallback backend

---

## ðŸ“ Project Structure

```text
recoverai/
â”‚
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ ai_models.py
â”‚   â”œâ”€â”€ analytics.py
â”‚   â”œâ”€â”€ customer_history.py
â”‚   â”œâ”€â”€ database.py
â”‚   â”œâ”€â”€ gemini_agent.py
â”‚   â”œâ”€â”€ init_db.py
â”‚   â”œâ”€â”€ main.py
â”‚   â”œâ”€â”€ models.py
â”‚   â”œâ”€â”€ recovery.py
â”‚   â”œâ”€â”€ recovery_engine.py
â”‚   â”œâ”€â”€ webhooks.py
â”‚   â”œâ”€â”€ test_gemini.py
â”‚   â”œâ”€â”€ test_policy.py
â”‚   â”œâ”€â”€ test_recovery.py
â”‚   â””â”€â”€ .gitignore
â”‚
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ analytics/
â”‚   â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”œâ”€â”€ demo/
â”‚   â”‚   â”œâ”€â”€ login/
â”‚   â”‚   â”œâ”€â”€ recovery/
â”‚   â”‚   â”œâ”€â”€ transactions/
â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ AppShell.tsx
â”‚   â”‚   â”œâ”€â”€ Sidebar.tsx
â”‚   â”‚   â””â”€â”€ Topbar.tsx
â”‚   â”‚
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ supabase.ts
â”‚   â”‚   â””â”€â”€ supabase-server.ts
â”‚   â”‚
â”‚   â””â”€â”€ proxy.ts
â”‚
â”œâ”€â”€ test-gemini-payment.json
â”œâ”€â”€ test-payment.json
â””â”€â”€ .gitignore
```

---

## ðŸ” Authentication

RecoverAI uses Supabase Authentication with Google OAuth.

The application includes:

- Google sign-in
- Secure OAuth callback
- Session management
- Protected application routes
- Logout
- Authenticated user display

Unauthenticated users are redirected to the login screen.

---

## ðŸ§ª Demo Scenarios

RecoverAI includes a built-in demo simulator designed to demonstrate the complete recovery lifecycle.

### Scenario 1 â€” Automatic Recovery

```text
Customer
    â†“
Payment Failed
    â†“
Insufficient Funds
    â†“
Gemini recommends Retry
    â†“
Policy approves
    â†“
Automatic execution
    â†“
Revenue recovered
```

### Scenario 2 â€” Human Review

```text
Customer
    â†“
Payment Failed
    â†“
Unexpected Processing Error
    â†“
Human review required
    â†“
Operator approves
    â†“
Recovery execution
    â†“
Revenue recovered
```

These scenarios demonstrate both **autonomous execution** and **human governance**.

---

## ðŸš€ Local Development

### 1. Clone the repository

```bash
git clone https://github.com/Renukaprasad-dev/recoverai.git
cd recoverai
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create:

```text
backend/.env
```

with your local database and Gemini configuration.

### 3. Initialize the database

From the project root:

```bash
python -m backend.init_db
```

### 4. Start the backend

From the project root:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Backend:

```text
http://localhost:8000
```

### 5. Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

## âš™ï¸ Environment Variables

### Backend

```env
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=postgres
GEMINI_API_KEY=
```

### Frontend

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Never commit real secrets to GitHub.**

---

## ðŸ§ª Testing

The backend includes tests for:

- Gemini recovery decisions
- Recovery policy validation
- Recovery engine behavior

Example:

```bash
python -m backend.test_gemini
python -m backend.test_policy
python -m backend.test_recovery
```

---

## ðŸŽ¯ Design Principles

RecoverAI is built around five principles:

### 1. AI-first diagnosis

Use AI to understand payment failures instead of relying only on static rules.

### 2. Deterministic safety

AI recommendations are validated against explicit policy constraints before execution.

### 3. Autonomous when safe

Low-risk, high-confidence recovery actions can execute automatically.

### 4. Human when necessary

Uncertain, unknown, or high-risk situations are escalated to humans.

### 5. Everything is auditable

Recovery decisions and outcomes are recorded so the system can explain what happened.

---

## ðŸ’° The Core Metric

The most important outcome is not the number of AI decisions.

It is:

> **Revenue recovered from failed payments.**

RecoverAI therefore tracks the complete journey from failed payment value to successfully recovered revenue.

---

## ðŸ† Buildathon Demo

The recommended demonstration flow is:

```text
1. Login
      â†“
2. Show failed payment
      â†“
3. Trigger recovery simulation
      â†“
4. Gemini diagnoses failure
      â†“
5. Policy guardrail validates decision
      â†“
6. Automatic recovery
      â†“
7. Show recovered revenue
      â†“
8. Trigger human-review scenario
      â†“
9. Approve recovery
      â†“
10. Execute recovery
      â†“
11. Show Analytics
      â†“
12. Show Audit Trail
```

The demo is designed to show that RecoverAI is not simply an AI chatbot â€” it is an **end-to-end revenue recovery system**.

---

## ðŸ”’ Security Notes

Never commit:

- `.env`
- `.env.local`
- API keys
- Database passwords
- OAuth client secrets
- Private credentials
- Production webhook secrets

Environment files are excluded through `.gitignore`.

---

## ðŸ“Œ Project Status

### Completed

- [x] Payment failure webhook processing
- [x] Webhook signature validation
- [x] Event deduplication
- [x] Customer history
- [x] Gemini AI recovery decisions
- [x] Structured AI output
- [x] Deterministic policy guardrails
- [x] Automatic recovery
- [x] Human approval workflow
- [x] Recovery execution
- [x] Analytics dashboard
- [x] Audit trail
- [x] Google authentication
- [x] Protected routes
- [x] Demo simulator
- [x] GitHub repository

### Next

- [x] Production deployment
- [ ] Demo video
- [ ] Final buildathon submission

---

## ðŸ‘©â€ðŸ’» Author

**Renukaprasad-dev**

Built for the Razorpay AI Buildathon.

---

## â­ Why RecoverAI?

RecoverAI combines:

**AI reasoning + deterministic safety + autonomous execution + human governance + measurable revenue recovery**

into one system.

The goal is simple:

> **Turn failed payments into recovered revenue â€” safely and intelligently.**


## Production Demo

**Live application:** https://recoverai-taupe.vercel.app

The production deployment has been verified on both desktop and mobile.

---

