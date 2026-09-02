import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db

from backend.models import (
    AuditLog,
    Customer,
    FailedTransaction,
    Merchant,
    RecoveryCampaign,
)

from backend.recovery_engine import (
    decide_recovery,
    validate_ai_decision,
    RecoveryDecision,
)

from backend.gemini_agent import generate_recovery_decision

from backend.customer_history import get_customer_payment_history


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/v1/webhook",
    tags=["Webhooks"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class PaymentData(BaseModel):
    id: str
    amount: int = Field(gt=0)
    currency: str = "INR"
    method: str
    error_reason: str


class CustomerData(BaseModel):
    name: str
    email: str
    phone: str | None = None


class PaymentFailedWebhook(BaseModel):
    event: str
    payment: PaymentData
    customer: CustomerData


# ============================================================
# PAYMENT FAILED WEBHOOK
# ============================================================

@router.post("/payment-failed")
async def payment_failed_webhook(
    payload: PaymentFailedWebhook,
    db: AsyncSession = Depends(get_db),
):

    # ========================================================
    # 1. VALIDATE EVENT
    # ========================================================

    if payload.event != "payment.failed":
        raise HTTPException(
            status_code=400,
            detail="Invalid event type",
        )

    # ========================================================
    # 2. PREVENT DUPLICATE PROCESSING
    # ========================================================

    existing_result = await db.execute(
        select(FailedTransaction).where(
            FailedTransaction.razorpay_payment_id
            == payload.payment.id
        )
    )

    existing_transaction = (
        existing_result.scalar_one_or_none()
    )

    if existing_transaction:

        return {
            "status": "already_processed",
            "transaction_id": existing_transaction.id,
            "payment_id": payload.payment.id,
        }

    # ========================================================
    # 3. FIND OR CREATE MERCHANT
    # ========================================================

    merchant_result = await db.execute(
        select(Merchant).limit(1)
    )

    merchant = merchant_result.scalar_one_or_none()

    if merchant is None:

        merchant = Merchant(
            name="RecoverAI Demo Merchant",
            email="demo@recoverai.local",
        )

        db.add(merchant)

        await db.flush()

    # ========================================================
    # 4. FIND OR CREATE CUSTOMER
    # ========================================================

    customer_result = await db.execute(
        select(Customer).where(
            Customer.merchant_id == merchant.id,
            Customer.email == payload.customer.email,
        )
    )

    customer = customer_result.scalar_one_or_none()

    if customer is None:

        customer = Customer(
            merchant_id=merchant.id,
            name=payload.customer.name,
            email=payload.customer.email,
            phone=payload.customer.phone,
        )

        db.add(customer)

        await db.flush()

    else:

        # Update customer information if the webhook
        # contains newer details.

        customer.name = payload.customer.name

        if payload.customer.phone:
            customer.phone = payload.customer.phone

    # ========================================================
    # 5. AMOUNT
    # ========================================================

    # RecoverAI demo webhook receives amounts directly
    # in the currency unit.
    #
    # Example:
    #
    # 7000 = ₹7,000
    #
    # IMPORTANT:
    # Do NOT divide by 100 here.

    amount_rupees = Decimal(
        payload.payment.amount
    )

    # ========================================================
    # 6. SAVE FAILED TRANSACTION
    # ========================================================

    transaction = FailedTransaction(

        merchant_id=merchant.id,

        customer_id=customer.id,

        razorpay_payment_id=(
            payload.payment.id
        ),

        amount=amount_rupees,

        currency=payload.payment.currency,

        failure_reason=(
            payload.payment.error_reason
        ),

        payment_method=(
            payload.payment.method
        ),

        status="failed",

        metadata_json=json.dumps(
            payload.model_dump()
        ),
    )

    db.add(transaction)

    await db.flush()

    # ========================================================
    # 7. GET PREVIOUS CUSTOMER PAYMENT HISTORY
    # ========================================================

    previous_transactions = (
        await get_customer_payment_history(
            db=db,
            customer_id=customer.id,
            current_transaction_id=transaction.id,
        )
    )

    payment_history = []

    for previous in previous_transactions:

        payment_history.append(
            {
                "amount": float(
                    previous.amount
                ),

                "currency": (
                    previous.currency
                ),

                "failure_reason": (
                    previous.failure_reason
                    or "unknown"
                ),

                "payment_method": (
                    previous.payment_method
                    or "unknown"
                ),

                "created_at": (
                    previous.created_at.isoformat()
                    if previous.created_at
                    else None
                ),
            }
        )

    # ========================================================
    # 8. GET AI RECOVERY DECISION
    # ========================================================

    ai_decision = None

    decision_source = "gemini"

    try:

        ai_result = generate_recovery_decision(

            customer_name=(
                customer.name
                or "Customer"
            ),

            customer_email=(
                customer.email
            ),

            amount=float(
                transaction.amount
            ),

            currency=(
                transaction.currency
            ),

            failure_reason=(
                transaction.failure_reason
                or "unknown"
            ),

            payment_method=(
                transaction.payment_method
                or "unknown"
            ),

            payment_history=(
                payment_history
            ),
        )

        # ----------------------------------------------------
        # Convert Gemini result into RecoverAI decision object
        # ----------------------------------------------------

        ai_decision = RecoveryDecision(

            strategy=(
                ai_result.strategy
            ),

            reason=(
                ai_result.reason
            ),

            retry_after_minutes=(
                ai_result.retry_after_minutes
            ),

            discount_percent=(
                ai_result.discount_percent
            ),

            requires_human_approval=(
                ai_result.requires_human_approval
            ),

            confidence=(
                ai_result.confidence
            ),
        )

    except Exception as error:

        # ====================================================
        # GEMINI FAILURE FALLBACK
        # ====================================================

        decision_source = (
            "deterministic_fallback"
        )

        fallback_decision = decide_recovery(

            failure_reason=(
                transaction.failure_reason
            ),

            amount=(
                transaction.amount
            ),
        )

        ai_decision = RecoveryDecision(

            strategy=(
                fallback_decision.strategy
            ),

            reason=(
                "Gemini was unavailable. "
                "RecoverAI used the deterministic "
                "fallback policy. "
                f"Error: {type(error).__name__}"
            ),

            retry_after_minutes=(
                fallback_decision.retry_after_minutes
            ),

            discount_percent=(
                fallback_decision.discount_percent
            ),

            requires_human_approval=(
                fallback_decision.requires_human_approval
            ),

            confidence=(
                fallback_decision.confidence
            ),
        )

    # ========================================================
    # 9. POLICY VALIDATION
    # ========================================================

    final_decision = validate_ai_decision(

        ai_decision=ai_decision,

        failure_reason=(
            transaction.failure_reason
        ),
    )

    # ========================================================
    # 10. CREATE RECOVERY CAMPAIGN
    # ========================================================

    campaign = RecoveryCampaign(

        transaction_id=(
            transaction.id
        ),

        strategy=(
            final_decision.strategy
        ),

        reason=(
            final_decision.reason
        ),

        retry_after_minutes=(
            final_decision.retry_after_minutes
        ),

        discount_percent=(
            final_decision.discount_percent
        ),

        status=(
            "pending_human_review"
            if final_decision.requires_human_approval
            else "planned"
        ),

        requires_human_approval=(
            final_decision.requires_human_approval
        ),

        ai_confidence=(
            final_decision.confidence
        ),
    )

    db.add(campaign)

    await db.flush()

    # ========================================================
    # 11. CREATE AUDIT LOG
    # ========================================================

    audit_log = AuditLog(

        campaign_id=(
            campaign.id
        ),

        event_type=(
            "RECOVERY_DECISION"
        ),

        actor=(
            decision_source
        ),

        decision=(
            final_decision.strategy
        ),

        explanation=(
            final_decision.reason
        ),

        # ----------------------------------------------------
        # INPUT SNAPSHOT
        # ----------------------------------------------------

        input_snapshot=json.dumps(
            {
                "transaction_id": (
                    transaction.id
                ),

                "payment_id": (
                    transaction.razorpay_payment_id
                ),

                "customer": {
                    "name": customer.name,
                    "email": customer.email,
                },

                "amount": float(
                    transaction.amount
                ),

                "currency": (
                    transaction.currency
                ),

                "failure_reason": (
                    transaction.failure_reason
                ),

                "payment_method": (
                    transaction.payment_method
                ),

                "previous_payment_history": (
                    payment_history
                ),
            }
        ),

        # ----------------------------------------------------
        # OUTPUT SNAPSHOT
        # ----------------------------------------------------

        output_snapshot=json.dumps(
            {
                "decision_source": (
                    decision_source
                ),

                "strategy": (
                    final_decision.strategy
                ),

                "reason": (
                    final_decision.reason
                ),

                "retry_after_minutes": (
                    final_decision.retry_after_minutes
                ),

                "discount_percent": (

                    float(
                        final_decision.discount_percent
                    )

                    if (
                        final_decision.discount_percent
                        is not None
                    )

                    else None
                ),

                "requires_human_approval": (
                    final_decision
                    .requires_human_approval
                ),

                "confidence": float(
                    final_decision.confidence
                ),
            }
        ),
    )

    db.add(audit_log)

    # ========================================================
    # 12. COMMIT EVERYTHING
    # ========================================================

    await db.commit()

    await db.refresh(
        transaction
    )

    await db.refresh(
        campaign
    )

    await db.refresh(
        audit_log
    )

    # ========================================================
    # 13. RETURN RESPONSE
    # ========================================================

    return {

        "status": "processed",

        "message": (
            "Payment failure recorded and "
            "AI recovery decision generated"
        ),

        "transaction_id": (
            transaction.id
        ),

        "payment_id": (
            transaction.razorpay_payment_id
        ),

        "amount": float(
            transaction.amount
        ),

        "currency": (
            transaction.currency
        ),

        "recovery": {

            "campaign_id": (
                campaign.id
            ),

            "strategy": (
                campaign.strategy
            ),

            "reason": (
                campaign.reason
            ),

            "retry_after_minutes": (
                campaign.retry_after_minutes
            ),

            "discount_percent": (

                float(
                    campaign.discount_percent
                )

                if (
                    campaign.discount_percent
                    is not None
                )

                else None
            ),

            "requires_human_approval": (
                campaign.requires_human_approval
            ),

            "confidence": float(
                campaign.ai_confidence
            ),

            "decision_source": (
                decision_source
            ),

            "previous_payments_considered": (
                len(payment_history)
            ),
        },
    }