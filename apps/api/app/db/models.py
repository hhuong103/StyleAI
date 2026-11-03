from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

J = JSON().with_variant(JSONB(), "postgresql")


def uid():
    return str(uuid4())


def now():
    return datetime.now(UTC)


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Identity, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    google_sub: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="USER")
    status: Mapped[str] = mapped_column(String(10), default="ACTIVE")
    __table_args__ = (
        CheckConstraint("role IN ('USER','ADMIN')"),
        CheckConstraint("status IN ('ACTIVE','DISABLED')"),
        UniqueConstraint("google_sub", name="uq_users_google_sub"),
    )


class AuthSession(Identity, Base):
    __tablename__ = "auth_sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family_id: Mapped[str] = mapped_column(String(36))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_id: Mapped[str | None] = mapped_column(String(36))


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80))
    gender: Mapped[str | None] = mapped_column(String(10))
    age_range: Mapped[str | None] = mapped_column(String(30))
    locale: Mapped[str] = mapped_column(String(10), default="vi-VN")


class Preference(Base):
    __tablename__ = "preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    budget_min_vnd: Mapped[int | None] = mapped_column(BigInteger)
    budget_max_vnd: Mapped[int | None] = mapped_column(BigInteger)
    __table_args__ = (
        CheckConstraint("budget_min_vnd IS NULL OR budget_min_vnd >= 0"),
        CheckConstraint("budget_max_vnd IS NULL OR budget_max_vnd > 0"),
        CheckConstraint(
            "budget_min_vnd IS NULL OR budget_max_vnd IS NULL OR budget_min_vnd <= budget_max_vnd"
        ),
    )


class Category(Base):
    __tablename__ = "categories"
    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    parent_code: Mapped[str | None] = mapped_column(ForeignKey("categories.code"))
    item_role: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Style(Base):
    __tablename__ = "styles"
    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Occasion(Base):
    __tablename__ = "occasions"
    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Color(Base):
    __tablename__ = "colors"
    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    hex: Mapped[str] = mapped_column(String(7))
    family: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class PreferenceStyle(Base):
    __tablename__ = "preference_styles"
    user_id: Mapped[str] = mapped_column(ForeignKey("preferences.user_id"), primary_key=True)
    style_code: Mapped[str] = mapped_column(ForeignKey("styles.code"), primary_key=True)


class PreferenceColor(Base):
    __tablename__ = "preference_colors"
    user_id: Mapped[str] = mapped_column(ForeignKey("preferences.user_id"), primary_key=True)
    color_code: Mapped[str] = mapped_column(ForeignKey("colors.code"), primary_key=True)


class Product(Identity, Base):
    __tablename__ = "products"
    product_code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    brand: Mapped[str | None] = mapped_column(String(80))
    category_code: Mapped[str] = mapped_column(ForeignKey("categories.code"), index=True)
    gender: Mapped[str] = mapped_column(String(10), default="UNISEX")
    color_code: Mapped[str] = mapped_column(ForeignKey("colors.code"))
    base_price_vnd: Mapped[int] = mapped_column(BigInteger, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(100), default="manual")
    price_source: Mapped[str] = mapped_column(String(10), default="DEMO")
    variants: Mapped[list["Variant"]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    images: Mapped[list["ProductImage"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="ProductImage.sort_order"
    )
    styles: Mapped[list["ProductStyle"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )
    occasions: Mapped[list["ProductOccasion"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )
    __table_args__ = (
        CheckConstraint("base_price_vnd >= 0"),
        CheckConstraint("gender IN ('MALE','FEMALE','UNISEX')"),
        CheckConstraint("price_source IN ('REAL','DEMO')"),
        Index("ix_product_eligibility", "category_code", "gender", "active"),
    )


class Variant(Identity, Base):
    __tablename__ = "product_variants"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True)
    size_code: Mapped[str] = mapped_column(String(20), default="ONE_SIZE")
    price_override_vnd: Mapped[int | None] = mapped_column(BigInteger)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        UniqueConstraint("product_id", "size_code"),
        UniqueConstraint("id", "product_id"),
        CheckConstraint("price_override_vnd IS NULL OR price_override_vnd >= 0"),
    )


class ProductImage(Identity, Base):
    __tablename__ = "product_images"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    storage_key: Mapped[str] = mapped_column(String(200))
    alt_text: Mapped[str] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    source_url: Mapped[str | None] = mapped_column(Text)
    attribution: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (
        Index(
            "one_primary_image",
            "product_id",
            unique=True,
            postgresql_where=text("is_primary"),
            sqlite_where=text("is_primary = 1"),
        ),
    )


class ProductStyle(Base):
    __tablename__ = "product_styles"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), primary_key=True)
    style_code: Mapped[str] = mapped_column(ForeignKey("styles.code"), primary_key=True)


class ProductOccasion(Base):
    __tablename__ = "product_occasions"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), primary_key=True)
    occasion_code: Mapped[str] = mapped_column(ForeignKey("occasions.code"), primary_key=True)


class OutfitRule(Identity, Base):
    __tablename__ = "outfit_rules"
    rule_key: Mapped[str] = mapped_column(String(80))
    version: Mapped[int] = mapped_column(Integer, default=1)
    occasion_code: Mapped[str] = mapped_column(ForeignKey("occasions.code"))
    style_code: Mapped[str | None] = mapped_column(ForeignKey("styles.code"))
    gender: Mapped[str | None] = mapped_column(String(10))
    slots: Mapped[list] = mapped_column(J)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("rule_key", "version"),)


class StylistPlan(Identity, Base):
    __tablename__ = "stylist_plans"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    raw_text: Mapped[str | None] = mapped_column(Text)
    normalized_context: Mapped[dict] = mapped_column(J)
    template: Mapped[dict] = mapped_column(J)
    rule_id: Mapped[str] = mapped_column(ForeignKey("outfit_rules.id"))
    parser_version: Mapped[str] = mapped_column(String(40), default="deterministic-v1")
    schema_version: Mapped[str] = mapped_column(String(10), default="1.0")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Recommendation(Identity, Base):
    __tablename__ = "recommendations"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("stylist_plans.id"))
    context_snapshot: Mapped[dict] = mapped_column(J)
    algorithm_version: Mapped[str] = mapped_column(String(80))
    catalog_version: Mapped[str] = mapped_column(String(80))
    rule_version: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    diagnostics: Mapped[dict] = mapped_column(J)
    result_snapshot: Mapped[dict] = mapped_column(J)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class RecommendationItem(Identity, Base):
    __tablename__ = "recommendation_items"
    recommendation_id: Mapped[str] = mapped_column(ForeignKey("recommendations.id"), index=True)
    slot_key: Mapped[str] = mapped_column(String(30))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str] = mapped_column(String(36))
    rank: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Numeric(8, 6))
    score_components: Mapped[dict] = mapped_column(J)
    reasons: Mapped[list] = mapped_column(J)
    product_snapshot: Mapped[dict] = mapped_column(J)
    __table_args__ = (
        UniqueConstraint("recommendation_id", "slot_key", "product_id"),
        UniqueConstraint("recommendation_id", "slot_key", "rank"),
        CheckConstraint("score >= 0 AND score <= 1 AND rank > 0"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"], ["product_variants.id", "product_variants.product_id"]
        ),
    )


class RecommendationLook(Identity, Base):
    __tablename__ = "recommendation_looks"
    recommendation_id: Mapped[str] = mapped_column(ForeignKey("recommendations.id"), index=True)
    label: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(120))
    total_price_vnd: Mapped[int] = mapped_column(BigInteger)
    score: Mapped[float] = mapped_column(Numeric(8, 6))
    budget_limit_vnd: Mapped[int] = mapped_column(BigInteger)
    visual: Mapped[dict] = mapped_column(J)
    reasons: Mapped[list] = mapped_column(J)
    source_look_id: Mapped[str | None] = mapped_column(ForeignKey("recommendation_looks.id"))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    items: Mapped[list["LookItem"]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    __table_args__ = (
        CheckConstraint("total_price_vnd >= 0 AND total_price_vnd <= budget_limit_vnd"),
        CheckConstraint("score >= 0 AND score <= 1"),
    )


class LookItem(Identity, Base):
    __tablename__ = "recommendation_look_items"
    look_id: Mapped[str] = mapped_column(ForeignKey("recommendation_looks.id"), index=True)
    slot_key: Mapped[str] = mapped_column(String(30))
    item_role: Mapped[str] = mapped_column(String(20))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str] = mapped_column(String(36))
    recommendation_item_id: Mapped[str | None] = mapped_column(
        ForeignKey("recommendation_items.id")
    )
    score: Mapped[float] = mapped_column(Numeric(8, 6))
    reasons: Mapped[list] = mapped_column(J)
    snapshot: Mapped[dict] = mapped_column(J)
    __table_args__ = (
        UniqueConstraint("look_id", "slot_key"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"], ["product_variants.id", "product_variants.product_id"]
        ),
    )


class Outfit(Identity, Base):
    __tablename__ = "outfits"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    source_look_id: Mapped[str | None] = mapped_column(ForeignKey("recommendation_looks.id"))
    name: Mapped[str] = mapped_column(String(120))
    occasion_code: Mapped[str] = mapped_column(ForeignKey("occasions.code"))
    style_code: Mapped[str | None] = mapped_column(ForeignKey("styles.code"))
    context_snapshot: Mapped[dict] = mapped_column(J)
    total_price_vnd: Mapped[int] = mapped_column(BigInteger)
    score: Mapped[float] = mapped_column(Numeric(8, 6))
    visual: Mapped[dict] = mapped_column(J)
    reasons: Mapped[list] = mapped_column(J)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    items: Mapped[list["OutfitItem"]] = relationship(lazy="selectin", cascade="all, delete-orphan")


class OutfitItem(Identity, Base):
    __tablename__ = "outfit_items"
    outfit_id: Mapped[str] = mapped_column(ForeignKey("outfits.id"), index=True)
    slot_key: Mapped[str] = mapped_column(String(30))
    item_role: Mapped[str] = mapped_column(String(20))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str] = mapped_column(String(36))
    price_snapshot_vnd: Mapped[int] = mapped_column(BigInteger)
    product_snapshot: Mapped[dict] = mapped_column(J)
    __table_args__ = (
        UniqueConstraint("outfit_id", "slot_key"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"], ["product_variants.id", "product_variants.product_id"]
        ),
    )


class Feedback(Identity, Base):
    __tablename__ = "feedback"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    recommendation_id: Mapped[str | None] = mapped_column(ForeignKey("recommendations.id"))
    recommendation_item_id: Mapped[str | None] = mapped_column(
        ForeignKey("recommendation_items.id")
    )
    look_id: Mapped[str | None] = mapped_column(ForeignKey("recommendation_looks.id"))
    outfit_id: Mapped[str | None] = mapped_column(ForeignKey("outfits.id"))
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"))
    value: Mapped[str] = mapped_column(String(10))
    reason_code: Mapped[str | None] = mapped_column(String(50))
    context: Mapped[dict] = mapped_column(J)
    __table_args__ = (
        CheckConstraint("value IN ('LIKE','DISLIKE')"),
        CheckConstraint(
            "(CASE WHEN recommendation_id IS NULL THEN 0 ELSE 1 END + CASE WHEN recommendation_item_id IS NULL THEN 0 ELSE 1 END + CASE WHEN look_id IS NULL THEN 0 ELSE 1 END + CASE WHEN outfit_id IS NULL THEN 0 ELSE 1 END + CASE WHEN product_id IS NULL THEN 0 ELSE 1 END) = 1"
        ),
        *(
            UniqueConstraint("user_id", col)
            for col in [
                "recommendation_id",
                "recommendation_item_id",
                "look_id",
                "outfit_id",
                "product_id",
            ]
        ),
    )


class CatalogImport(Identity, Base):
    __tablename__ = "catalog_imports"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    file_key: Mapped[str] = mapped_column(String(200))
    checksum: Mapped[str] = mapped_column(String(64))
    mapping_version: Mapped[str] = mapped_column(String(20), default="v1")
    status: Mapped[str] = mapped_column(String(20))
    counts: Mapped[dict] = mapped_column(J)
    report: Mapped[dict] = mapped_column(J)
    catalog_version: Mapped[str | None] = mapped_column(String(80))


class AdminAudit(Identity, Base):
    __tablename__ = "admin_audit_logs"
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(80))
    request_id: Mapped[str] = mapped_column(String(80))
    changes: Mapped[dict] = mapped_column(J)


class IdempotencyRequest(Identity, Base):
    __tablename__ = "idempotency_requests"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    scope: Mapped[str] = mapped_column(String(250))
    key: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(J)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("user_id", "scope", "key"),)
