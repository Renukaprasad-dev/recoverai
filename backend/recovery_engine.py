from dataclasses import dataclass
from decimal import Decimal


# ============================================================
# RECOVERAI — RECOVERY POLICY ENGINE
# ============================================================
#
# Gemini proposes a recovery action.
# This module is the deterministic governance layer.
#
# IMPORTANT:
# Gemini NEVER gets final authority over execution.
# Every AI decision must pass these policy checks first.
# ============================================================


@dataclass
class RecoveryDecision:
    strategy: str
    reason: str
    retry_after_minutes: int | None
    discount_percent: Decimal | None
    requires_human_approval: bool
    confidence: Decimal


# ============================================================
# POLICY LIMITS
# ============================================================

MAX_RETRY_DELAY_MINUTES = 1440          # 24 hours
MAX_DISCOUNT_PERCENT = Decimal("10")    # Maximum 10%
MIN_CONFIDENCE_FOR_AUTOMATION = Decimal("0.70")


# ============================================================
# FAILURE-REASON NORMALIZATION
# ============================================================

def normalize_failure_reason(failure_reason: str | None) -> str:
    """
    Normalize common failure-reason aliases so that the same
    business failure cannot accidentally bypass policy rules.
    """

    reason = (failure_reason or "").lower().strip()

    aliases = {
        "expired_card": "card_expired",
        "card_expired": "card_expired",

        "insufficient_funds": "insufficient_funds",
        "insufficient_balance": "insufficient_funds",

        "network_error": "network_error",
        "gateway_timeout": "gateway_timeout",

        "temporary_failure": "temporary_failure",

        "authentication_failed": "authentication_failed",
        "authentication_failure": "authentication_failed",
    }

    return aliases.get(reason, reason)


# ============================================================
# DETERMINISTIC FALLBACK DECISION
# ============================================================

def decide_recovery(
    failure_reason: str | None,
    amount: Decimal,
) -> RecoveryDecision:

    reason = normalize_failure_reason(failure_reason)

    # --------------------------------------------------------
    # TEMPORARY / RETRIABLE FAILURES
    # --------------------------------------------------------

    if reason in {"insufficient_funds", "temporary_failure"}:
        return RecoveryDecision(
            strategy="retry",
            reason=(
                "The payment failure is classified as a potentially "
                "temporary failure. A delayed retry is permitted under "
                "the approved recovery policy."
            ),
            retry_after_minutes=360,
            discount_percent=None,
            requires_human_approval=False,
            confidence=Decimal("0.85"),
        )

    # --------------------------------------------------------
    # NETWORK / GATEWAY FAILURES
    # --------------------------------------------------------

    if reason in {"network_error", "gateway_timeout"}:
        return RecoveryDecision(
            strategy="retry",
            reason=(
                "The payment appears to have failed because of a "
                "temporary network or gateway issue. A short retry "
                "window is permitted by policy."
            ),
            retry_after_minutes=30,
            discount_percent=None,
            requires_human_approval=False,
            confidence=Decimal("0.92"),
        )

    # --------------------------------------------------------
    # EXPIRED CARD
    # --------------------------------------------------------

    if reason == "card_expired":
        return RecoveryDecision(
            strategy="update_payment_method",
            reason=(
                "The payment method appears to be expired. The customer "
                "should update their payment method before another charge "
                "is attempted."
            ),
            retry_after_minutes=None,
            discount_percent=None,
            requires_human_approval=False,
            confidence=Decimal("0.96"),
        )

    # --------------------------------------------------------
    # AUTHENTICATION FAILURE
    # --------------------------------------------------------

    if reason == "authentication_failed":
        return RecoveryDecision(
            strategy="customer_authentication",
            reason=(
                "The payment requires successful customer authentication "
                "before another recovery attempt can be made."
            ),
            retry_after_minutes=None,
            discount_percent=None,
            requires_human_approval=False,
            confidence=Decimal("0.94"),
        )

    # --------------------------------------------------------
    # UNKNOWN FAILURE
    # --------------------------------------------------------

    return RecoveryDecision(
        strategy="human_review",
        reason=(
            "The failure reason is unknown or outside the approved "
            "automated recovery policies."
        ),
        retry_after_minutes=None,
        discount_percent=None,
        requires_human_approval=True,
        confidence=Decimal("0.40"),
    )


# ============================================================
# AI DECISION VALIDATION
# ============================================================

def validate_ai_decision(
    ai_decision,
    failure_reason: str | None,
):
    """
    Validate Gemini's proposed decision against deterministic
    RecoverAI governance rules.

    Gemini can recommend.
    The policy engine decides whether that recommendation
    is safe to execute automatically.
    """

    reason = normalize_failure_reason(failure_reason)

    allowed_failures = {
        "insufficient_funds",
        "temporary_failure",
        "network_error",
        "gateway_timeout",
        "card_expired",
        "authentication_failed",
    }

    # --------------------------------------------------------
    # UNKNOWN FAILURE REASON
    # --------------------------------------------------------

    if reason not in allowed_failures:
        return RecoveryDecision(
            strategy="human_review",
            reason=(
                "Automated recovery is not permitted because the "
                "failure reason is outside the approved recovery policy."
            ),
            retry_after_minutes=None,
            discount_percent=None,
            requires_human_approval=True,
            confidence=Decimal("0.0"),
        )

    # --------------------------------------------------------
    # AI CONFIDENCE CHECK
    # --------------------------------------------------------

    if ai_decision.confidence < MIN_CONFIDENCE_FOR_AUTOMATION:
        return RecoveryDecision(
            strategy="human_review",
            reason=(
                "Gemini's confidence is below the minimum threshold "
                "required for automated recovery."
            ),
            retry_after_minutes=None,
            discount_percent=None,
            requires_human_approval=True,
            confidence=Decimal("0.0"),
        )

    # --------------------------------------------------------
    # DISCOUNT LIMIT
    # --------------------------------------------------------

    discount = ai_decision.discount_percent

    if discount is not None and Decimal(str(discount)) > MAX_DISCOUNT_PERCENT:
        return RecoveryDecision(
            strategy="human_review",
            reason=(
                "The proposed discount exceeds the maximum permitted "
                "automated recovery limit of 10%."
            ),
            retry_after_minutes=None,
            discount_percent=None,
            requires_human_approval=True,
            confidence=Decimal("0.0"),
        )

    # --------------------------------------------------------
    # RETRY DELAY CHECK
    # --------------------------------------------------------

    retry_delay = ai_decision.retry_after_minutes

    if ai_decision.strategy == "retry":

        if retry_delay is None:
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "Gemini proposed a retry but did not provide a valid "
                    "retry delay."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

        if retry_delay < 0 or retry_delay > MAX_RETRY_DELAY_MINUTES:
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "The proposed retry delay is outside the approved "
                    "automated recovery window."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

    # --------------------------------------------------------
    # FAILURE-SPECIFIC STRATEGY RULES
    # --------------------------------------------------------

    # Insufficient funds must use retry.
    if reason == "insufficient_funds":

        if ai_decision.strategy != "retry":
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "For insufficient-funds failures, automated recovery "
                    "is permitted only through the approved retry strategy."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

    # Temporary failures must use retry.
    if reason == "temporary_failure":

        if ai_decision.strategy != "retry":
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "Temporary payment failures may only use the approved "
                    "retry strategy for automated recovery."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

    # Network/gateway failures must use retry.
    if reason in {"network_error", "gateway_timeout"}:

        if ai_decision.strategy != "retry":
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "Network and gateway failures may only use the approved "
                    "retry strategy for automated recovery."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

    # Expired card must update payment method.
    if reason == "card_expired":

        if ai_decision.strategy != "update_payment_method":
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "Expired-card failures require the customer to update "
                    "their payment method before recovery."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

    # Authentication failures must require authentication.
    if reason == "authentication_failed":

        if ai_decision.strategy != "customer_authentication":
            return RecoveryDecision(
                strategy="human_review",
                reason=(
                    "Authentication failures require customer "
                    "authentication before automated recovery."
                ),
                retry_after_minutes=None,
                discount_percent=None,
                requires_human_approval=True,
                confidence=Decimal("0.0"),
            )

    # --------------------------------------------------------
    # APPROVED AUTOMATIC DECISION
    # --------------------------------------------------------
    #
    # IMPORTANT:
    # We intentionally force requires_human_approval=False here.
    #
    # Gemini may say:
    #     "human approval required"
    #
    # but if the action itself satisfies the deterministic
    # governance rules, the policy engine remains authoritative.
    # --------------------------------------------------------

    return RecoveryDecision(
        strategy=ai_decision.strategy,
        reason=ai_decision.reason,
        retry_after_minutes=ai_decision.retry_after_minutes,
        discount_percent=(
            Decimal(str(ai_decision.discount_percent))
            if ai_decision.discount_percent is not None
            else None
        ),
        requires_human_approval=False,
        confidence=Decimal(str(ai_decision.confidence)),
    )