from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.core.outputs import Output, ProductOutput
from app.core.schemas import Input


class ModelInput(Input):
    name: str = Field(min_length=1, max_length=100)
    presentation: Literal["FEMALE", "MALE", "ANDROGYNOUS"]
    asset_key: str = Field(min_length=1, max_length=200)
    license_note: str = Field(min_length=10, max_length=2000)


class SessionInput(Input):
    model_id: UUID


class SessionPatch(Input):
    version: int = Field(ge=1)
    model_id: UUID | None = None
    outfit_id: UUID | None = None
    filter_id: Literal["COOL_STUDIO", "NEUTRAL_STUDIO", "WARM_STUDIO"] | None = None
    realism: int | None = Field(default=None, ge=0, le=100)


class GarmentInput(Input):
    product_id: UUID
    variant_id: UUID
    slot: Literal["INNER_TOP", "OUTERWEAR", "BOTTOM", "FULL_BODY", "SHOES", "BAG", "ACCESSORY"]


class ComposeInput(Input):
    name: str = Field(min_length=1, max_length=120)
    garments: list[GarmentInput] = Field(min_length=1, max_length=7)
    source_id: UUID | None = None

    @model_validator(mode="after")
    def compatible(self):
        slots = [item.slot for item in self.garments]
        if len(set(slots)) != len(slots) or len({item.product_id for item in self.garments}) != len(
            slots
        ):
            raise ValueError("Duplicate slots/products")
        if "FULL_BODY" in slots and ({"INNER_TOP", "BOTTOM"} & set(slots)):
            raise ValueError("Full-body garment conflicts with separates")
        if "FULL_BODY" not in slots and not {"INNER_TOP", "BOTTOM"} <= set(slots):
            raise ValueError("A complete outfit needs inner top and bottom or full body")
        if "SHOES" not in slots:
            raise ValueError("A complete outfit needs footwear")
        return self


class VerifyProductInput(Input):
    retailer_sku: str = Field(min_length=1, max_length=100)
    evidence: str = Field(min_length=20, max_length=4000)
    valid_hours: int = Field(default=24, ge=1, le=168)


class BoundTryOnInput(Input):
    session_id: UUID
    session_version: int = Field(ge=1)
    try_on_mode: Literal["MULTI_GARMENT"] = "MULTI_GARMENT"
    consent_external_processing: Literal[True]


class ReviewInput(Input):
    approve: bool
    evidence: str = Field(min_length=20, max_length=4000)
    result_image_hash: str = Field(pattern=r"^[0-9a-f]{64}$")


class SavedLookInput(Input):
    result_id: UUID
    name: str = Field(min_length=1, max_length=120)


class ShoppingItemInput(Input):
    product_id: UUID


class OutboundInput(Input):
    result_id: UUID
    region_id: UUID
    interaction: Literal["HOVER", "TAP", "CLICK"]


class RecommendationInput(Input):
    session_id: UUID
    occasion: str = Field(min_length=1, max_length=40)
    style: str = Field(min_length=1, max_length=40)
    budget_max_vnd: int = Field(gt=0, le=100_000_000)
    preferred_colors: list[str] = Field(default_factory=list, max_length=12)
    sizes: dict[str, str] = Field(default_factory=dict, max_length=7)


class PreferencesPatch(Input):
    preferred_styles: list[str] | None = Field(default=None, max_length=8)
    favorite_colors: list[str] | None = Field(default=None, max_length=12)
    budget_min_vnd: int | None = Field(default=None, ge=0, le=100_000_000)
    budget_max_vnd: int | None = Field(default=None, gt=0, le=100_000_000)


class ModelOutput(Output):
    model_id: UUID
    name: str
    presentation: Literal["FEMALE", "MALE", "ANDROGYNOUS"]
    full_body_image_url: str
    portrait_url: str
    model_version: int
    asset_version: int
    asset_hash: str
    supported_try_on_modes: list[str]
    customization: dict[str, bool]
    identity_quality_verification: str


class SessionOutput(Output):
    session_id: UUID
    model_id: UUID
    version: int
    outfit_id: UUID | None
    active_job_id: UUID | None
    filter_id: str
    realism: int
    realism_supported: bool


class VerifiedProductOutput(ProductOutput):
    verification_status: Literal["VERIFIED", "UNVERIFIED"]
    verification_method: str | None


class GarmentOutput(Output):
    garment_id: UUID
    product_id: UUID
    variant_id: UUID
    slot: str
    selected_variant: dict
    product: VerifiedProductOutput


class CompositionOutput(Output):
    outfit_id: UUID
    revision: int
    name: str
    total_price_vnd: int
    currency: Literal["VND"]
    garments: list[GarmentOutput]
    accordion: dict[str, dict]
