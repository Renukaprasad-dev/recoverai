from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from backend.database import get_db
    from backend.models import (
        Customer,
        FailedTransaction,
        RecoveryCampaign,
    )
except ModuleNotFoundError:
    from database import get_db
    from models import (
        Customer,
        FailedTransaction,
        RecoveryCampaign,
    )


router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["Analytics"],
)


# ============================================================
# HELPERS
# ============================================================

def decimal_to_float(value):
    if value is None:
        return 0.0

    if isinstance(value, Decimal):
        return float(value)

    return float(value)


# ============================================================
# ANALYTICS OVERVIEW
# ============================================================

@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(get_db),
):

    # --------------------------------------------------------
    # 1. Total failed payments
    # --------------------------------------------------------

    total_transactions_result = await db.execute(
        select(
            func.count(FailedTransaction.id)
        )
    )

    total_failed_payments = (
        total_transactions_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 2. Total failed payment value
    # --------------------------------------------------------

    failed_value_result = await db.execute(
        select(
            func.coalesce(
                func.sum(FailedTransaction.amount),
                0,
            )
        )
    )

    failed_payment_value = (
        failed_value_result.scalar()
        or Decimal("0")
    )

    # --------------------------------------------------------
    # 3. Total recovery campaigns
    # --------------------------------------------------------

    campaigns_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        )
    )

    total_recovery_campaigns = (
        campaigns_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 4. Pending human reviews
    # --------------------------------------------------------

    pending_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        ).where(
            RecoveryCampaign.status
            == "pending_human_review"
        )
    )

    pending_human_reviews = (
        pending_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 5. Human approved
    # --------------------------------------------------------

    approved_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        ).where(
            RecoveryCampaign.status
            == "approved"
        )
    )

    human_approved = (
        approved_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 6. Human rejected
    # --------------------------------------------------------

    rejected_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        ).where(
            RecoveryCampaign.status
            == "rejected"
        )
    )

    human_rejected = (
        rejected_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 7. Successful recoveries
    # --------------------------------------------------------

    successful_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        ).where(
            RecoveryCampaign.status
            == "executed_success"
        )
    )

    successful_recoveries = (
        successful_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 8. Failed recovery executions
    # --------------------------------------------------------

    failed_execution_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        ).where(
            RecoveryCampaign.status
            == "executed_failed"
        )
    )

    failed_recoveries = (
        failed_execution_result.scalar() or 0
    )

    # --------------------------------------------------------
    # 9. Recovered revenue
    # --------------------------------------------------------

    recovered_value_result = await db.execute(
        select(
            func.coalesce(
                func.sum(FailedTransaction.amount),
                0,
            )
        ).where(
            FailedTransaction.status
            == "recovered"
        )
    )

    recovered_revenue = (
        recovered_value_result.scalar()
        or Decimal("0")
    )

    # --------------------------------------------------------
    # 10. Recovery rate
    # --------------------------------------------------------

    if total_failed_payments > 0:

        recovery_rate = round(
            (
                successful_recoveries
                / total_failed_payments
            ) * 100,
            2,
        )

    else:

        recovery_rate = 0.0

    # --------------------------------------------------------
    # 11. Human review rate
    # --------------------------------------------------------

    human_review_cases_result = await db.execute(
        select(
            func.count(RecoveryCampaign.id)
        ).where(
            RecoveryCampaign.strategy
            == "human_review"
        )
    )

    human_review_cases = (
        human_review_cases_result.scalar() or 0
    )

    if total_recovery_campaigns > 0:

        human_review_rate = round(
            (
                human_review_cases
                / total_recovery_campaigns
            ) * 100,
            2,
        )

    else:

        human_review_rate = 0.0

    # --------------------------------------------------------
    # 12. Recent activity
    # --------------------------------------------------------

    recent_result = await db.execute(
        select(
            RecoveryCampaign,
            FailedTransaction,
            Customer,
        )
        .join(
            FailedTransaction,
            RecoveryCampaign.transaction_id
            == FailedTransaction.id,
        )
        .join(
            Customer,
            FailedTransaction.customer_id
            == Customer.id,
        )
        .order_by(
            RecoveryCampaign.created_at.desc()
        )
        .limit(10)
    )

    recent_rows = recent_result.all()

    recent_activity = []

    for campaign, transaction, customer in recent_rows:

        recent_activity.append(
            {
                "campaign_id": campaign.id,

                "transaction_id": transaction.id,

                "payment_id": (
                    transaction.razorpay_payment_id
                ),

                "customer": customer.name,

                "amount": decimal_to_float(
                    transaction.amount
                ),

                "currency": transaction.currency,

                "failure_reason": (
                    transaction.failure_reason
                ),

                "strategy": campaign.strategy,

                "status": campaign.status,

                "requires_human_approval": (
                    campaign.requires_human_approval
                ),

                "confidence": decimal_to_float(
                    campaign.ai_confidence
                ),

                "created_at": (
                    campaign.created_at.isoformat()
                    if campaign.created_at
                    else None
                ),
            }
        )

    # --------------------------------------------------------
    # 13. Return analytics
    # --------------------------------------------------------

    return {
        "total_failed_payments":
            total_failed_payments,

        "failed_payment_value":
            decimal_to_float(
                failed_payment_value
            ),

        "total_recovery_campaigns":
            total_recovery_campaigns,

        "pending_human_reviews":
            pending_human_reviews,

        "human_approved":
            human_approved,

        "human_rejected":
            human_rejected,

        "successful_recoveries":
            successful_recoveries,

        "failed_recoveries":
            failed_recoveries,

        "recovered_revenue":
            decimal_to_float(
                recovered_revenue
            ),

        "recovery_rate":
            recovery_rate,

        "human_review_rate":
            human_review_rate,

        "recent_activity":
            recent_activity,
    }
