from decimal import Decimal

from recovery_engine import (
    RecoveryDecision,
    validate_ai_decision,
)


# ============================================================
# TEST 1 — SAFE AI DECISION
# ============================================================

safe_decision = RecoveryDecision(
    strategy="retry",
    reason="Temporary insufficient funds.",
    retry_after_minutes=1440,
    discount_percent=None,
    requires_human_approval=False,
    confidence=Decimal("0.95"),
)

validated = validate_ai_decision(
    safe_decision,
    "insufficient_funds",
)

print("\n===== SAFE AI DECISION =====")
print("Strategy:", validated.strategy)
print("Retry:", validated.retry_after_minutes)
print(
    "Human approval:",
    validated.requires_human_approval,
)
print("Confidence:", validated.confidence)


# ============================================================
# TEST 2 — UNSAFE DISCOUNT
# ============================================================

unsafe_decision = RecoveryDecision(
    strategy="retry",
    reason="Offer a large discount.",
    retry_after_minutes=None,
    discount_percent=Decimal("50"),
    requires_human_approval=False,
    confidence=Decimal("0.95"),
)

validated = validate_ai_decision(
    unsafe_decision,
    "insufficient_funds",
)

print("\n===== UNSAFE DISCOUNT =====")
print("Strategy:", validated.strategy)
print("Reason:", validated.reason)
print(
    "Human approval:",
    validated.requires_human_approval,
)


# ============================================================
# TEST 3 — UNKNOWN FAILURE
# ============================================================

unknown_decision = RecoveryDecision(
    strategy="retry",
    reason="Retry the payment.",
    retry_after_minutes=30,
    discount_percent=None,
    requires_human_approval=False,
    confidence=Decimal("0.95"),
)

validated = validate_ai_decision(
    unknown_decision,
    "unknown_failure",
)

print("\n===== UNKNOWN FAILURE =====")
print("Strategy:", validated.strategy)
print("Reason:", validated.reason)
print(
    "Human approval:",
    validated.requires_human_approval,
)