from backend.gemini_agent import generate_recovery_decision

decision = generate_recovery_decision(
    customer_name="Ananya Sharma",
    customer_email="ananya.demo@example.com",
    amount=7500.0,
    currency="INR",
    failure_reason="insufficient_funds",
    payment_method="card",
)

print("\n===== GEMINI RECOVERY DECISION =====")

print("Strategy:", decision.strategy)
print("Reason:", decision.reason)
print(
    "Retry after:",
    decision.retry_after_minutes,
)
print(
    "Discount:",
    decision.discount_percent,
)
print(
    "Human approval:",
    decision.requires_human_approval,
)
print(
    "Confidence:",
    decision.confidence,
)