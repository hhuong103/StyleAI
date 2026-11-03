from typing import Any, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

T = TypeVar("T")
Gender = Literal["MALE", "FEMALE", "UNISEX"]
Role = Literal["TOP", "BOTTOM", "OUTERWEAR", "SHOES"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: dict[str, Any]


class Register(Input):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)


class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleLogin(Input):
    credential: str = Field(min_length=20, max_length=8192)


class ProfileUpdate(Input):
    display_name: str = Field(min_length=1, max_length=80)
    gender: Gender | None = None
    age_range: str | None = Field(default=None, max_length=30)
    locale: Literal["vi-VN", "en-US"] = "vi-VN"
    preferred_styles: list[str] = Field(default_factory=list, max_length=8)
    favorite_colors: list[str] = Field(default_factory=list, max_length=12)
    budget_min_vnd: int | None = Field(default=None, ge=0, le=100_000_000)
    budget_max_vnd: int | None = Field(default=None, gt=0, le=100_000_000)

    @model_validator(mode="after")
    def budget_order(self):
        if (
            self.budget_min_vnd is not None
            and self.budget_max_vnd is not None
            and self.budget_min_vnd > self.budget_max_vnd
        ):
            raise ValueError("budget_min_vnd must not exceed budget_max_vnd")
        return self


class VariantCreate(Input):
    sku: str = Field(min_length=1, max_length=100)
    size_code: str = Field(default="ONE_SIZE", min_length=1, max_length=20)
    price_override_vnd: int | None = Field(default=None, ge=0, le=100_000_000)
    available: bool = True
    active: bool = True


class VariantUpdate(Input):
    price_override_vnd: int | None = Field(default=None, ge=0, le=100_000_000)
    available: bool | None = None
    active: bool | None = None


class ProductInput(Input):
    product_code: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=160)
    brand: str | None = Field(default=None, max_length=80)
    category_code: str
    gender: Gender = "UNISEX"
    color_code: str
    base_price_vnd: int = Field(ge=0, le=100_000_000)
    description: str = Field(default="", max_length=5000)
    active: bool = True
    price_source: Literal["REAL", "DEMO"] = "DEMO"
    styles: list[str] = Field(default_factory=list, max_length=8)
    occasions: list[str] = Field(default_factory=list, max_length=7)
    image_key: str = Field(min_length=1, max_length=200)


class ProductCreate(ProductInput):
    variants: list[VariantCreate] = Field(min_length=1, max_length=30)


class Context(Input):
    gender: Gender | None = None
    occasion: str | None = None
    style: str | None = None
    preferred_colors: list[str] | None = Field(default=None, max_length=12)
    budget_max_vnd: int | None = Field(default=None, gt=0, le=100_000_000)
    sizes: dict[str, str] = Field(default_factory=dict)


class PlanInput(Input):
    text: str = Field(default="", max_length=2000)
    locale: Literal["vi-VN", "en-US"] = "vi-VN"
    context: Context = Field(default_factory=Context)


class RecommendationInput(Input):
    plan_id: UUID
    top_k: int = Field(default=5, ge=1, le=20)


class ReplacementInput(Input):
    slot_key: str = Field(min_length=1, max_length=30)
    variant_id: UUID


class SaveOutfit(Input):
    look_id: UUID
    name: str | None = Field(default=None, min_length=1, max_length=120)


class OutfitUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_favorite: bool | None = None
    version: int = Field(ge=1)


class FeedbackInput(Input):
    target_type: Literal["RECOMMENDATION", "RECOMMENDATION_ITEM", "LOOK", "OUTFIT", "PRODUCT"]
    target_id: UUID
    value: Literal["LIKE", "DISLIKE"]
    reason_code: str | None = Field(default=None, max_length=50)


class TaxonomyInput(Input):
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{0,39}$")
    label: str = Field(min_length=1, max_length=80)
    item_role: Role | None = None
    parent_code: str | None = None
    hex: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    family: Literal["NEUTRAL", "WARM", "COOL"] | None = None
    active: bool = True


class Slot(Input):
    slot_key: str = Field(pattern=r"^[a-z_]{1,30}$")
    role: Role
    categories: list[str] = Field(min_length=1, max_length=10)
    required: Literal[True] = True


class RuleInput(Input):
    rule_key: str = Field(pattern=r"^[a-z0-9_]{1,80}$")
    occasion_code: str
    style_code: str | None = None
    gender: Gender | None = None
    slots: list[Slot] = Field(min_length=1, max_length=4)
    priority: int = Field(default=0, ge=0, le=100)

    @model_validator(mode="after")
    def unique_roles(self):
        if len({s.slot_key for s in self.slots}) != len(self.slots) or len(
            {s.role for s in self.slots}
        ) != len(self.slots):
            raise ValueError("Slots and roles must be unique")
        return self
