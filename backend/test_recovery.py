from decimal import Decimal

from recovery_engine import decide_recovery


decision = decide_recovery(
    failure_reason="insufficient_funds",
    amount=Decimal("5000.00"),
)

print("Strategy:", decision.strategy)
print("Reason:", decision.reason)
print("Retry after:", decision.retry_after_minutes)
print("Discount:", decision.discount_percent)
print("Human approval:", decision.requires_human_approval)
print("Confidence:", decision.confidence)
