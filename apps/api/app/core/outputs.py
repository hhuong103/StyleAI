"""Public output schemas: keep OpenAPI useful to clients, not only prose examples."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Output(BaseModel):
    model_config = ConfigDict(extra="allow")


class UserOutput(Output):
    id: str
    email: str
    role: Literal["USER", "ADMIN"]
    display_name: str
    profile_completed: bool


class ImageOutput(Output):
    url: str
    alt_text: str


class VariantOutput(Output):
    id: str
    sku: str
    size_code: str
    price_vnd: int
    price_override_vnd: int | None
    available: bool
    active: bool


class ProductOutput(Output):
    id: str
    product_code: str
    name: str
    brand: str | None
    category: str
    gender: str
    color: str
    price_vnd: int
    base_price_vnd: int
    description: str
    active: bool
    available: bool
    price_source: Literal["DEMO", "REAL"]
    image: ImageOutput | None
    images: list[ImageOutput]
    styles: list[str]
    occasions: list[str]
    variants: list[VariantOutput]


class ReasonOutput(Output):
    code: str
    facts: dict[str, Any]


class LookItemOutput(Output):
    slot_key: str
    role: str
    product_id: str
    variant_id: str
    product_code: str
    name: str
    brand: str | None
    category: str
    color: str
    gender: str
    price_vnd: int = Field(ge=0)
    price_source: Literal["DEMO", "REAL"]
    size_code: str
    image: ImageOutput | None
    score: float = Field(ge=0, le=1)
    score_components: dict[str, float]
    reasons: list[ReasonOutput]


class LookOutput(Output):
    look_id: str
    recommendation_id: str
    label: Literal["BEST_MATCH", "ALTERNATIVE", "BUDGET_CHOICE"]
    name: str
    revision: int
    source_look_id: str | None
    score: float
    total_price_vnd: int
    budget_max_vnd: int
    budget_status: Literal["WITHIN_BUDGET"]
    reasons: list[ReasonOutput]
    visual: dict[str, Any]
    items: list[LookItemOutput]


class SlotOutput(Output):
    slot_key: str
    role: str
    requested_categories: list[str]
    items: list[LookItemOutput]


class RecommendationOutput(Output):
    recommendation_id: str
    status: Literal["COMPLETE", "PARTIAL", "NO_RESULTS"]
    algorithm_version: str
    currency: Literal["VND"]
    budget_max_vnd: int
    context: dict[str, Any]
    slot_results: list[SlotOutput]
    looks: list[LookOutput]
    diagnostics: dict[str, Any]
