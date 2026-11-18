"""Relational identity, composition and shopping provenance for VELL."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Identity, J
from app.db.session import Base


class ModelPreset(Identity, Base):
    __tablename__ = "vell_model_presets"
    name: Mapped[str] = mapped_column(String(100))
    presentation: Mapped[str] = mapped_column(String(20))
    asset_key: Mapped[str] = mapped_column(String(200))
    asset_hash: Mapped[str] = mapped_column(String(64))
    asset_version: Mapped[int] = mapped_column(Integer, default=1)
    license_note: Mapped[str] = mapped_column(Text)
    __table_args__ = (CheckConstraint("presentation IN ('FEMALE','MALE','ANDROGYNOUS')"),)


class StudioSession(Identity, Base):
    __tablename__ = "vell_sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("vell_model_presets.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    outfit_id: Mapped[str | None] = mapped_column(ForeignKey("vell_compositions.id"))
    active_job_id: Mapped[str | None] = mapped_column(ForeignKey("vell_try_on_jobs.id"))
    filter_id: Mapped[str] = mapped_column(String(30), default="COOL_STUDIO")
    realism: Mapped[int] = mapped_column(Integer, default=75)
    __table_args__ = (CheckConstraint("realism >= 0 AND realism <= 100"),)


class Composition(Identity, Base):
    __tablename__ = "vell_compositions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("vell_compositions.id"))


class CompositionItem(Identity, Base):
    __tablename__ = "vell_composition_items"
    outfit_id: Mapped[str] = mapped_column(ForeignKey("vell_compositions.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str] = mapped_column(ForeignKey("product_variants.id"))
    slot: Mapped[str] = mapped_column(String(20))
    __table_args__ = (
        UniqueConstraint("outfit_id", "slot"),
        UniqueConstraint("outfit_id", "product_id"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"], ["product_variants.id", "product_variants.product_id"]
        ),
    )


class ProductVerification(Identity, Base):
    __tablename__ = "vell_product_verifications"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    verified_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    product_fingerprint: Mapped[str] = mapped_column(String(64))
    retailer_sku: Mapped[str] = mapped_column(String(100))
    evidence: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class JobBinding(Base):
    __tablename__ = "vell_job_bindings"
    job_id: Mapped[str] = mapped_column(ForeignKey("vell_try_on_jobs.id"), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("vell_sessions.id"), index=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("vell_model_presets.id"))
    model_asset_hash: Mapped[str] = mapped_column(String(64))
    model_asset_version: Mapped[int] = mapped_column(Integer)
    session_version: Mapped[int] = mapped_column(Integer)
    outfit_id: Mapped[str] = mapped_column(ForeignKey("vell_compositions.id"))
    outfit_revision: Mapped[int] = mapped_column(Integer)
    cache_key: Mapped[str] = mapped_column(String(64), index=True)
    output_hash: Mapped[str | None] = mapped_column(String(64))
    segmentation_status: Mapped[str] = mapped_column(String(20), default="NOT_CONFIGURED")
    segmentation_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    segmentation_error: Mapped[dict | None] = mapped_column(J, nullable=True)
    quality_status: Mapped[str] = mapped_column(String(20), default="UNREVIEWED")


class GarmentRegion(Identity, Base):
    __tablename__ = "vell_garment_regions"
    job_id: Mapped[str] = mapped_column(ForeignKey("vell_job_bindings.job_id"), index=True)
    garment_id: Mapped[str] = mapped_column(ForeignKey("vell_composition_items.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    polygon: Mapped[list] = mapped_column(J)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4))
    layer_priority: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="PENDING_REVIEW")


class SavedStudioLook(Identity, Base):
    __tablename__ = "vell_saved_looks"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("vell_job_bindings.job_id"))
    name: Mapped[str] = mapped_column(String(120))


class ShoppingItem(Identity, Base):
    __tablename__ = "vell_shopping_items"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    kind: Mapped[str] = mapped_column(String(10))
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", "kind"),
        CheckConstraint("kind IN ('WISHLIST','BAG')"),
    )


class VellAudit(Identity, Base):
    __tablename__ = "vell_audit_events"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[dict] = mapped_column(J)
