import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

try:
    from backend.ai_models import AIRecoveryDecision
except ModuleNotFoundError:
    from ai_models import AIRecoveryDecision


# ============================================================
# ENVIRONMENT
# ============================================================

# Your .env is inside:
# E:\RecoverAI\backend\.env
#
# We explicitly load that file so the application works
# regardless of the directory from which Uvicorn is started.

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(dotenv_path=ENV_FILE)


# ============================================================
# GEMINI CONFIGURATION
# ============================================================

GEMINI_MODEL = "gemini-3-flash-preview"


# ============================================================
# CLIENT
# ============================================================

def get_gemini_client() -> genai.Client:

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. "
            f"Expected it in: {ENV_FILE}"
        )

    return genai.Client(
        api_key=api_key
    )


# ============================================================
# RECOVERY DECISION
# ============================================================

def generate_recovery_decision(
    customer_name: str,
    customer_email: str,
    amount: float,
    currency: str,
    failure_reason: str,
    payment_method: str,
    payment_history: list[dict[str, Any]] | None = None,
) -> AIRecoveryDecision:

    # --------------------------------------------------------
    # Client
    # --------------------------------------------------------

    client = get_gemini_client()

    # --------------------------------------------------------
    # Payment history
    # --------------------------------------------------------

    if payment_history is None:
        payment_history = []

    history_text = (
        "No previous failed payments found."
    )

    if payment_history:

        history_lines = []

        for item in payment_history:

            history_lines.append(
                f"- Amount: {item.get('amount')} "
                f"{item.get('currency')}, "
                f"Failure: {item.get('failure_reason')}, "
                f"Method: {item.get('payment_method')}, "
                f"Date: {item.get('created_at')}"
            )

        history_text = "\n".join(
            history_lines
        )

    # --------------------------------------------------------
    # Prompt
    # --------------------------------------------------------

    prompt = f"""
You are the AI recovery decision engine for RecoverAI,
an autonomous revenue recovery system.

Your responsibility is to recommend ONE safe recovery
strategy for a failed payment.

You are an AI recommendation layer.

The backend contains a separate deterministic policy
engine that validates your recommendation before any
recovery action can be executed.

============================================================
CUSTOMER
============================================================

Name: {customer_name}
Email: {customer_email}

============================================================
CURRENT TRANSACTION
============================================================

Amount: {amount} {currency}
Payment method: {payment_method}
Failure reason: {failure_reason}

============================================================
PREVIOUS PAYMENT HISTORY
============================================================

{history_text}

Use previous payment history only as supporting context.

Never assume that a previous failure has the same cause
as the current failure.

============================================================
APPROVED RECOVERY STRATEGIES
============================================================

1. retry

Use for potentially temporary failures:

- insufficient_funds
- temporary_failure
- network_error
- gateway_timeout

2. update_payment_method

Use for:

- card_expired

3. customer_authentication

Use for:

- authentication_failed

4. human_review

Use when:

- the failure reason is unknown
- the situation is unsafe
- the appropriate strategy is unclear
- confidence is insufficient

============================================================
SAFETY REQUIREMENTS
============================================================

- Never recommend a discount above 10 percent.
- Never invent a recovery strategy.
- Never recommend repeated immediate retries.
- Never override the approved strategy categories.
- If uncertain, choose human_review.
- Be conservative.
- Previous payment history must never override
  the approved recovery policies.
- The backend will independently validate your decision.
- Return exactly one recovery decision.

============================================================
DECISION
============================================================

Return ONLY the structured recovery decision.
"""


    # ========================================================
    # GEMINI REQUEST
    # ========================================================

    try:

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AIRecoveryDecision.model_json_schema(),

                # Gemini 3 supports structured output.
                # We are not using tools/function calling.
                automatic_function_calling=(
                    types.AutomaticFunctionCallingConfig(
                        disable=True
                    )
                ),
            ),
        )

    except Exception as exc:

        raise RuntimeError(
            f"Gemini API request failed: "
            f"{type(exc).__name__}: {exc}"
        ) from exc


    # ========================================================
    # RESPONSE VALIDATION
    # ========================================================

    response_text = getattr(
        response,
        "text",
        None,
    )

    if not response_text:

        raise RuntimeError(
            "Gemini returned an empty response."
        )


    # ========================================================
    # PARSE STRUCTURED JSON
    # ========================================================

    try:

        decision = (
            AIRecoveryDecision
            .model_validate_json(
                response_text
            )
        )

    except Exception as exc:

        raise RuntimeError(
            "Gemini returned invalid structured output. "
            f"Response: {response_text!r}. "
            f"Validation error: {exc}"
        ) from exc


    # ========================================================
    # RETURN
    # ========================================================

    return decision
