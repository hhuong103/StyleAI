"""Relational VELL identities, sessions, compositions and verified shopping mappings."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    categories = sa.table(
        "categories",
        sa.column("code", sa.String(40)),
        sa.column("label", sa.String(80)),
        sa.column("item_role", sa.String(20)),
        sa.column("active", sa.Boolean()),
    )
    bind = op.get_bind()
    existing = set(bind.scalars(sa.select(categories.c.code)))
    for code, label, role in (
        ("VELL_DRESS", "Trang phục liền thân", "FULL_BODY"),
        ("VELL_BAG", "Túi", "ACCESSORY"),
        ("VELL_ACCESSORY", "Phụ kiện", "ACCESSORY"),
    ):
        if code not in existing:
            bind.execute(
                categories.insert().values(code=code, label=label, item_role=role, active=True)
            )
    op.create_table(
        "vell_model_presets",
        sa.Column("name", sa.String(length=100), nullable=False, primary_key=False),
        sa.Column("presentation", sa.String(length=20), nullable=False, primary_key=False),
        sa.Column("asset_key", sa.String(length=200), nullable=False, primary_key=False),
        sa.Column("asset_hash", sa.String(length=64), nullable=False, primary_key=False),
        sa.Column("asset_version", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("license_note", sa.Text(), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.CheckConstraint("presentation IN ('FEMALE','MALE','ANDROGYNOUS')"),
    )
    op.create_table(
        "vell_audit_events",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("action", sa.String(length=40), nullable=False, primary_key=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False, primary_key=False),
        sa.Column(
            "details",
            sa.JSON().with_variant(JSONB(), "postgresql"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
    )
    op.create_index("ix_vell_audit_events_user_id", "vell_audit_events", ["user_id"], unique=False)
    op.create_table(
        "vell_compositions",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False, primary_key=False),
        sa.Column("revision", sa.Integer(), nullable=False, primary_key=False),
        sa.Column(
            "source_id",
            sa.String(length=36),
            sa.ForeignKey("vell_compositions.id"),
            nullable=True,
            primary_key=False,
        ),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
    )
    op.create_index("ix_vell_compositions_user_id", "vell_compositions", ["user_id"], unique=False)
    op.create_table(
        "vell_product_verifications",
        sa.Column(
            "product_id",
            sa.String(length=36),
            sa.ForeignKey("products.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "verified_by",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("product_fingerprint", sa.String(length=64), nullable=False, primary_key=False),
        sa.Column("retailer_sku", sa.String(length=100), nullable=False, primary_key=False),
        sa.Column("evidence", sa.Text(), nullable=False, primary_key=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
    )
    op.create_index(
        "ix_vell_product_verifications_product_id",
        "vell_product_verifications",
        ["product_id"],
        unique=False,
    )
    op.create_table(
        "vell_sessions",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "model_id",
            sa.String(length=36),
            sa.ForeignKey("vell_model_presets.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False, primary_key=False),
        sa.Column(
            "outfit_id",
            sa.String(length=36),
            sa.ForeignKey("vell_compositions.id"),
            nullable=True,
            primary_key=False,
        ),
        sa.Column(
            "active_job_id",
            sa.String(length=36),
            sa.ForeignKey("vell_try_on_jobs.id"),
            nullable=True,
            primary_key=False,
        ),
        sa.Column("filter_id", sa.String(length=30), nullable=False, primary_key=False),
        sa.Column("realism", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.CheckConstraint("realism >= 0 AND realism <= 100"),
    )
    op.create_index("ix_vell_sessions_user_id", "vell_sessions", ["user_id"], unique=False)
    op.create_table(
        "vell_shopping_items",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "product_id",
            sa.String(length=36),
            sa.ForeignKey("products.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("kind", sa.String(length=10), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.UniqueConstraint("user_id", "product_id", "kind"),
        sa.CheckConstraint("kind IN ('WISHLIST','BAG')"),
    )
    op.create_index(
        "ix_vell_shopping_items_user_id", "vell_shopping_items", ["user_id"], unique=False
    )
    op.create_table(
        "vell_composition_items",
        sa.Column(
            "outfit_id",
            sa.String(length=36),
            sa.ForeignKey("vell_compositions.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "product_id",
            sa.String(length=36),
            sa.ForeignKey("products.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "variant_id",
            sa.String(length=36),
            sa.ForeignKey("product_variants.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("slot", sa.String(length=20), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
        sa.UniqueConstraint("outfit_id", "product_id"),
        sa.UniqueConstraint("outfit_id", "slot"),
        sa.ForeignKeyConstraint(
            ["variant_id", "product_id"], ["product_variants.id", "product_variants.product_id"]
        ),
    )
    op.create_index(
        "ix_vell_composition_items_outfit_id", "vell_composition_items", ["outfit_id"], unique=False
    )
    op.create_table(
        "vell_job_bindings",
        sa.Column(
            "job_id",
            sa.String(length=36),
            sa.ForeignKey("vell_try_on_jobs.id"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "session_id",
            sa.String(length=36),
            sa.ForeignKey("vell_sessions.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "model_id",
            sa.String(length=36),
            sa.ForeignKey("vell_model_presets.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("model_asset_hash", sa.String(length=64), nullable=False, primary_key=False),
        sa.Column("model_asset_version", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("session_version", sa.Integer(), nullable=False, primary_key=False),
        sa.Column(
            "outfit_id",
            sa.String(length=36),
            sa.ForeignKey("vell_compositions.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("outfit_revision", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("cache_key", sa.String(length=64), nullable=False, primary_key=False),
        sa.Column("output_hash", sa.String(length=64), nullable=True, primary_key=False),
        sa.Column("segmentation_status", sa.String(length=20), nullable=False, primary_key=False),
        sa.Column("segmentation_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "segmentation_error", sa.JSON().with_variant(JSONB(), "postgresql"), nullable=True
        ),
        sa.Column("quality_status", sa.String(length=20), nullable=False, primary_key=False),
    )
    op.create_index(
        "ix_vell_job_bindings_session_id", "vell_job_bindings", ["session_id"], unique=False
    )
    op.create_index(
        "ix_vell_job_bindings_cache_key", "vell_job_bindings", ["cache_key"], unique=False
    )
    op.create_table(
        "vell_garment_regions",
        sa.Column(
            "job_id",
            sa.String(length=36),
            sa.ForeignKey("vell_job_bindings.job_id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "garment_id",
            sa.String(length=36),
            sa.ForeignKey("vell_composition_items.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "product_id",
            sa.String(length=36),
            sa.ForeignKey("products.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "polygon",
            sa.JSON().with_variant(JSONB(), "postgresql"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("confidence", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column("layer_priority", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("status", sa.String(length=20), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
    )
    op.create_index(
        "ix_vell_garment_regions_job_id", "vell_garment_regions", ["job_id"], unique=False
    )
    op.create_table(
        "vell_saved_looks",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column(
            "job_id",
            sa.String(length=36),
            sa.ForeignKey("vell_job_bindings.job_id"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False, primary_key=False),
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, primary_key=False),
    )
    op.create_index("ix_vell_saved_looks_user_id", "vell_saved_looks", ["user_id"], unique=False)


def downgrade():
    op.drop_table("vell_saved_looks")
    op.drop_table("vell_garment_regions")
    op.drop_table("vell_job_bindings")
    op.drop_table("vell_composition_items")
    op.drop_table("vell_shopping_items")
    op.drop_table("vell_sessions")
    op.drop_table("vell_product_verifications")
    op.drop_table("vell_compositions")
    op.drop_table("vell_audit_events")
    op.drop_table("vell_model_presets")
