from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import FailedTransaction

async def get_customer_payment_history(
    db: AsyncSession,
    customer_id: int,
    current_transaction_id: int,
):
    result = await db.execute(
        select(FailedTransaction)
        .where(
            FailedTransaction.customer_id == customer_id,
            FailedTransaction.id != current_transaction_id,
        )
        .order_by(
            FailedTransaction.created_at.desc()
        )
        .limit(10)
    )

    transactions = result.scalars().all()

    return transactions