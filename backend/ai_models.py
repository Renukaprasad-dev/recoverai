from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class AIRecoveryDecision(BaseModel):
    strategy: Literal[
        "retry",
        "update_payment_method",
        "customer_authentication",
        "human_review",
    ]

    reason: str = Field(
        min_length=10,
        max_length=1000,
    )

    retry_after_minutes: int | None = Field(
        default=None,
        ge=5,
        le=10080,
    )

    discount_percent: Decimal | None = Field(
        default=None,
        ge=0,
        le=10,
    )

    requires_human_approval: bool

    confidence: Decimal = Field(
        ge=0,
        le=1,
    )