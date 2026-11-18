from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.core.schemas import VirtualTryOnInput


class TryOnJobInput(VirtualTryOnInput):
    model_preset: Literal["VELL_SEO_YEON"] = "VELL_SEO_YEON"

    @model_validator(mode="after")
    def validate_products_and_identity(self):
        if len(set(self.selected_products)) != len(self.selected_products):
            raise ValueError("Products must be distinct")
        if self.gender != "FEMALE":
            raise ValueError("The VELL_SEO_YEON preset requires FEMALE gender")
        return self


class TryOnView(BaseModel):
    view: Literal["LEFT", "FRONT", "RIGHT"]
    url: str


class TryOnResult(BaseModel):
    request_id: UUID
    views: list[TryOnView] = Field(min_length=3, max_length=3)
    product_ids: list[UUID]
    background: str
    regions: list[dict] = Field(default_factory=list)
    segmentation_status: Literal["UNAVAILABLE"]
    disclaimer: str
    model_id: UUID | None = None
    model_asset_version: int | None = None
    outfit_id: UUID | None = None
    outfit_revision: int | None = None
    avatar_configuration_version: int | None = None
    result_image_hash: str | None = None
    quality_status: str | None = None
    generated_at: str | None = None


class JobError(BaseModel):
    code: str
    message: str


class TryOnJobOutput(BaseModel):
    id: UUID
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]
    provider: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    result: TryOnResult | None
    error: JobError | None
