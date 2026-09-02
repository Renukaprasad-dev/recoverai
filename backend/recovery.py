from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import (
    AuditLog,
    Customer,
    FailedTransaction,
    RecoveryCampaign,
)


router = APIRouter(
    prefix="/api/v1/recovery",
    tags=["Recovery"],
)


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class RecoveryExecutionRequest(BaseModel):
    outcome: str
    recovered_amount: Optional[float] = None


# ============================================================
# GET PENDING HUMAN REVIEWS
# ============================================================

@router.get("/pending")
async def get_pending_human_reviews(
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
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
        .where(
            RecoveryCampaign.status
            == "pending_human_review",
            RecoveryCampaign.requires_human_approval
            == True,
        )
        .order_by(
            RecoveryCampaign.created_at.desc()
        )
    )

    rows = result.all()

    cases = []

    for campaign, transaction, customer in rows:

        cases.append(
            {
                "campaign_id": campaign.id,

                "transaction_id": transaction.id,

                "payment_id": (
                    transaction.razorpay_payment_id
                ),

                "customer": {
                    "name": customer.name,
                    "email": customer.email,
                    "phone": customer.phone,
                },

                "amount": float(
                    transaction.amount
                ),

                "currency": transaction.currency,

                "failure_reason": (
                    transaction.failure_reason
                    or "unknown"
                ),

                "payment_method": (
                    transaction.payment_method
                    or "unknown"
                ),

                "strategy": campaign.strategy,

                "reason": campaign.reason,

                "retry_after_minutes": (
                    campaign.retry_after_minutes
                ),

                "discount_percent": (
                    float(campaign.discount_percent)
                    if campaign.discount_percent is not None
                    else None
                ),

                "requires_human_approval": (
                    campaign.requires_human_approval
                ),

                "confidence": (
                    float(campaign.ai_confidence)
                    if campaign.ai_confidence is not None
                    else None
                ),

                "status": campaign.status,

                "created_at": (
                    campaign.created_at.isoformat()
                    if campaign.created_at
                    else None
                ),
            }
        )

    return {
        "count": len(cases),
        "cases": cases,
    }


# ============================================================
# APPROVE RECOVERY CAMPAIGN
# ============================================================

@router.post("/{campaign_id}/approve")
async def approve_recovery_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(RecoveryCampaign).where(
            RecoveryCampaign.id == campaign_id
        )
    )

    campaign = result.scalar_one_or_none()

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Recovery campaign not found",
        )

    if campaign.status != "pending_human_review":
        raise HTTPException(
            status_code=409,
            detail=(
                "This recovery campaign is no longer "
                "pending human review."
            ),
        )

    campaign.status = "approved"
    campaign.requires_human_approval = False

    audit_log = AuditLog(
        campaign_id=campaign.id,
        event_type="HUMAN_APPROVAL",
        actor="human_reviewer",
        decision="approved",
        explanation=(
            "A human reviewer approved the recovery "
            "campaign after reviewing the AI-generated "
            "recommendation."
        ),
        input_snapshot=None,
        output_snapshot=(
            '{"status":"approved",'
            '"approved_by":"human_reviewer"}'
        ),
    )

    db.add(audit_log)

    await db.commit()

    await db.refresh(campaign)
    await db.refresh(audit_log)

    return {
        "status": "approved",

        "message": (
            "Recovery campaign approved by human reviewer"
        ),

        "campaign_id": campaign.id,

        "strategy": campaign.strategy,

        "campaign_status": campaign.status,

        "requires_human_approval": (
            campaign.requires_human_approval
        ),

        "audit_log_id": audit_log.id,
    }


# ============================================================
# REJECT RECOVERY CAMPAIGN
# ============================================================

@router.post("/{campaign_id}/reject")
async def reject_recovery_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(RecoveryCampaign).where(
            RecoveryCampaign.id == campaign_id
        )
    )

    campaign = result.scalar_one_or_none()

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Recovery campaign not found",
        )

    if campaign.status != "pending_human_review":
        raise HTTPException(
            status_code=409,
            detail=(
                "This recovery campaign is no longer "
                "pending human review."
            ),
        )

    campaign.status = "rejected"
    campaign.requires_human_approval = False

    audit_log = AuditLog(
        campaign_id=campaign.id,
        event_type="HUMAN_REJECTION",
        actor="human_reviewer",
        decision="rejected",
        explanation=(
            "A human reviewer rejected the recovery "
            "campaign after reviewing the AI-generated "
            "recommendation."
        ),
        input_snapshot=None,
        output_snapshot=(
            '{"status":"rejected",'
            '"rejected_by":"human_reviewer"}'
        ),
    )

    db.add(audit_log)

    await db.commit()

    await db.refresh(campaign)
    await db.refresh(audit_log)

    return {
        "status": "rejected",

        "message": (
            "Recovery campaign rejected by human reviewer"
        ),

        "campaign_id": campaign.id,

        "campaign_status": campaign.status,

        "requires_human_approval": (
            campaign.requires_human_approval
        ),

        "audit_log_id": audit_log.id,
    }


# ============================================================
# EXECUTE RECOVERY CAMPAIGN
# ============================================================

@router.post("/{campaign_id}/execute")
async def execute_recovery_campaign(
    campaign_id: int,
    request: RecoveryExecutionRequest,
    db: AsyncSession = Depends(get_db),
):

    # --------------------------------------------------------
    # VALIDATE OUTCOME
    # --------------------------------------------------------

    outcome = request.outcome.strip().lower()

    if outcome not in ["success", "failed"]:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid outcome. Use 'success' or 'failed'."
            ),
        )

    # --------------------------------------------------------
    # FIND CAMPAIGN
    # --------------------------------------------------------

    result = await db.execute(
        select(RecoveryCampaign).where(
            RecoveryCampaign.id == campaign_id
        )
    )

    campaign = result.scalar_one_or_none()

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Recovery campaign not found",
        )

    # --------------------------------------------------------
    # FIND TRANSACTION
    # --------------------------------------------------------

    transaction_result = await db.execute(
        select(FailedTransaction).where(
            FailedTransaction.id
            == campaign.transaction_id
        )
    )

    transaction = (
        transaction_result.scalar_one_or_none()
    )

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Failed transaction not found",
        )

    # --------------------------------------------------------
    # PREVENT DUPLICATE EXECUTION
    # --------------------------------------------------------

    if campaign.status in [
        "executed_success",
        "executed_failed",
    ]:
        raise HTTPException(
            status_code=409,
            detail=(
                "This recovery campaign has already "
                "been executed."
            ),
        )

    # --------------------------------------------------------
    # HUMAN APPROVAL SAFETY CHECK
    # --------------------------------------------------------

    if campaign.requires_human_approval:
        raise HTTPException(
            status_code=403,
            detail=(
                "Human approval is required before "
                "this recovery campaign can be executed."
            ),
        )

    # --------------------------------------------------------
    # RECOVERED AMOUNT
    # --------------------------------------------------------

    if outcome == "success":

        recovered_amount = (
            request.recovered_amount
            if request.recovered_amount is not None
            else float(transaction.amount)
        )

        transaction.status = "recovered"

        campaign.status = "executed_success"

    else:

        recovered_amount = (
            request.recovered_amount
            if request.recovered_amount is not None
            else 0
        )

        transaction.status = "failed"

        campaign.status = "executed_failed"

    # --------------------------------------------------------
    # AUDIT SNAPSHOTS
    # --------------------------------------------------------

    input_snapshot = (
        "{"
        f'"campaign_id": {campaign.id}, '
        f'"transaction_id": {transaction.id}, '
        f'"strategy": "{campaign.strategy}", '
        f'"requested_outcome": "{outcome}"'
        "}"
    )

    output_snapshot = (
        "{"
        f'"status": "{campaign.status}", '
        f'"execution_result": "{outcome}", '
        f'"recovered_amount": {recovered_amount}'
        "}"
    )

    # --------------------------------------------------------
    # AUDIT LOG
    # --------------------------------------------------------

    audit_log = AuditLog(
        campaign_id=campaign.id,
        event_type="RECOVERY_EXECUTION",
        actor="system",
        decision=outcome,
        explanation=(
            "Recovery campaign was executed in demo mode "
            "and the transaction outcome was recorded."
        ),
        input_snapshot=input_snapshot,
        output_snapshot=output_snapshot,
    )

    db.add(audit_log)

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    await db.commit()

    await db.refresh(campaign)
    await db.refresh(transaction)
    await db.refresh(audit_log)

    return {
        "status": "executed",

        "message": (
            "Recovery executed successfully in demo mode."
            if outcome == "success"
            else "Recovery execution completed in demo mode."
        ),

        "campaign_id": campaign.id,

        "transaction_id": transaction.id,

        "payment_id": (
            transaction.razorpay_payment_id
        ),

        "strategy": campaign.strategy,

        "execution_result": outcome,

        "transaction_status": transaction.status,

        "campaign_status": campaign.status,

        "recovered_amount": recovered_amount,

        "currency": transaction.currency,

        "demo_mode": True,

        "audit_log_id": audit_log.id,
    }


# ============================================================
# GET ALL TRANSACTIONS
# ============================================================

@router.get("/transactions")
async def get_transactions(
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(
            FailedTransaction,
            Customer,
            RecoveryCampaign,
        )
        .join(
            Customer,
            FailedTransaction.customer_id
            == Customer.id,
        )
        .outerjoin(
            RecoveryCampaign,
            RecoveryCampaign.transaction_id
            == FailedTransaction.id,
        )
        .order_by(
            FailedTransaction.created_at.desc()
        )
    )

    rows = result.all()

    transactions = []

    for transaction, customer, campaign in rows:

        campaign_data = None

        if campaign:

            campaign_data = {
                "campaign_id": campaign.id,

                "strategy": campaign.strategy,

                "reason": campaign.reason,

                "status": campaign.status,

                "requires_human_approval": (
                    campaign.requires_human_approval
                ),

                "confidence": (
                    float(campaign.ai_confidence)
                    if campaign.ai_confidence is not None
                    else None
                ),

                "retry_after_minutes": (
                    campaign.retry_after_minutes
                ),

                "discount_percent": (
                    float(campaign.discount_percent)
                    if campaign.discount_percent is not None
                    else None
                ),
            }

        transactions.append(
            {
                "transaction_id": transaction.id,

                "payment_id": (
                    transaction.razorpay_payment_id
                ),

                "customer": {
                    "name": customer.name,
                    "email": customer.email,
                    "phone": customer.phone,
                },

                "amount": float(
                    transaction.amount
                ),

                "currency": transaction.currency,

                "failure_reason": (
                    transaction.failure_reason
                    or "unknown"
                ),

                "payment_method": (
                    transaction.payment_method
                    or "unknown"
                ),

                "transaction_status": (
                    transaction.status
                ),

                "campaign": campaign_data,

                "created_at": (
                    transaction.created_at.isoformat()
                    if transaction.created_at
                    else None
                ),
            }
        )

    return {
        "count": len(transactions),
        "transactions": transactions,
    }


# ============================================================
# AUDIT TRAIL
# ============================================================

@router.get("/audit")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(
            AuditLog,
            RecoveryCampaign,
            FailedTransaction,
            Customer,
        )
        .outerjoin(
            RecoveryCampaign,
            AuditLog.campaign_id
            == RecoveryCampaign.id,
        )
        .outerjoin(
            FailedTransaction,
            RecoveryCampaign.transaction_id
            == FailedTransaction.id,
        )
        .outerjoin(
            Customer,
            FailedTransaction.customer_id
            == Customer.id,
        )
        .order_by(
            AuditLog.created_at.desc()
        )
    )

    rows = result.all()

    logs = []

    for (
        audit,
        campaign,
        transaction,
        customer,
    ) in rows:

        logs.append(
            {
                # ------------------------------------------------
                # AUDIT INFORMATION
                # ------------------------------------------------

                "audit_log_id": audit.id,

                "event_type": (
                    audit.event_type
                    if audit.event_type
                    else "UNKNOWN"
                ),

                "actor": (
                    audit.actor
                    if audit.actor
                    else "unknown"
                ),

                "decision": (
                    audit.decision
                    if audit.decision
                    else None
                ),

                "explanation": (
                    audit.explanation
                    if audit.explanation
                    else None
                ),

                # ------------------------------------------------
                # CAMPAIGN
                # ------------------------------------------------

                "campaign_id": (
                    campaign.id
                    if campaign
                    else None
                ),

                "strategy": (
                    campaign.strategy
                    if campaign
                    else None
                ),

                "campaign_status": (
                    campaign.status
                    if campaign
                    else None
                ),

                "requires_human_approval": (
                    campaign.requires_human_approval
                    if campaign
                    else None
                ),

                "confidence": (
                    float(campaign.ai_confidence)
                    if campaign
                    and campaign.ai_confidence is not None
                    else None
                ),

                # ------------------------------------------------
                # TRANSACTION
                # ------------------------------------------------

                "transaction_id": (
                    transaction.id
                    if transaction
                    else None
                ),

                "payment_id": (
                    transaction.razorpay_payment_id
                    if transaction
                    else None
                ),

                "amount": (
                    float(transaction.amount)
                    if transaction
                    and transaction.amount is not None
                    else None
                ),

                "currency": (
                    transaction.currency
                    if transaction
                    else None
                ),

                "failure_reason": (
                    transaction.failure_reason
                    if transaction
                    else None
                ),

                "payment_method": (
                    transaction.payment_method
                    if transaction
                    else None
                ),

                "transaction_status": (
                    transaction.status
                    if transaction
                    else None
                ),

                # ------------------------------------------------
                # CUSTOMER
                # ------------------------------------------------

                "customer": (
                    customer.name
                    if customer
                    else None
                ),

                "customer_email": (
                    customer.email
                    if customer
                    else None
                ),

                # ------------------------------------------------
                # SNAPSHOTS
                # ------------------------------------------------

                "input_snapshot": (
                    audit.input_snapshot
                ),

                "output_snapshot": (
                    audit.output_snapshot
                ),

                # ------------------------------------------------
                # TIMESTAMP
                # ------------------------------------------------

                "created_at": (
                    audit.created_at.isoformat()
                    if audit.created_at
                    else None
                ),
            }
        )

    return {
        "count": len(logs),
        "logs": logs,
    }