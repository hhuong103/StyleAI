"""Add VELL occasions and lounge categories to the existing recommendation engine."""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

CATEGORIES = {
    "LOUNGE_TOP": ("Áo mặc nhà", "TOP"),
    "LOUNGE_PANTS": ("Quần mặc nhà", "BOTTOM"),
    "SLIPPERS": ("Dép đi trong nhà", "SHOES"),
}
OCCASIONS = {
    "SCHOOL": "Đi học",
    "ATHLETIC": "Thể thao",
    "STREET": "Đường phố",
    "SLEEP": "Mặc nhà",
}
RULES = {
    "SCHOOL": ("CASUAL", ["SHIRT/POLO", "CARDIGAN", "JEANS/WIDE_LEG_PANTS", "SNEAKERS"]),
    "ATHLETIC": ("SPORTY", ["T_SHIRT", "LIGHT_JACKET", "JOGGERS/SHORTS", "SNEAKERS"]),
    "STREET": (
        "STREETWEAR",
        ["OVERSIZED_TEE", "LIGHT_JACKET/DENIM_JACKET", "CARGO/JEANS", "SNEAKERS"],
    ),
    "SLEEP": ("CASUAL", ["LOUNGE_TOP", "LOUNGE_PANTS", "SLIPPERS"]),
}
ROLES = {
    "SHIRT": "TOP",
    "POLO": "TOP",
    "T_SHIRT": "TOP",
    "OVERSIZED_TEE": "TOP",
    "LOUNGE_TOP": "TOP",
    "CARDIGAN": "OUTERWEAR",
    "LIGHT_JACKET": "OUTERWEAR",
    "DENIM_JACKET": "OUTERWEAR",
    "JEANS": "BOTTOM",
    "WIDE_LEG_PANTS": "BOTTOM",
    "JOGGERS": "BOTTOM",
    "SHORTS": "BOTTOM",
    "CARGO": "BOTTOM",
    "LOUNGE_PANTS": "BOTTOM",
    "SNEAKERS": "SHOES",
    "SLIPPERS": "SHOES",
}


def upgrade():
    bind = op.get_bind()
    categories = sa.table(
        "categories",
        sa.column("code", sa.String(40)),
        sa.column("label", sa.String(80)),
        sa.column("item_role", sa.String(20)),
        sa.column("active", sa.Boolean()),
    )
    occasions = sa.table(
        "occasions",
        sa.column("code", sa.String(40)),
        sa.column("label", sa.String(80)),
        sa.column("active", sa.Boolean()),
    )
    rules = sa.table(
        "outfit_rules",
        sa.column("id", sa.String(36)),
        sa.column("rule_key", sa.String(80)),
        sa.column("version", sa.Integer()),
        sa.column("occasion_code", sa.String(40)),
        sa.column("style_code", sa.String(40)),
        sa.column("gender", sa.String(10)),
        sa.column("slots", sa.JSON().with_variant(postgresql.JSONB(), "postgresql")),
        sa.column("priority", sa.Integer()),
        sa.column("active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    existing_categories = set(bind.scalars(sa.select(categories.c.code)))
    existing_occasions = set(bind.scalars(sa.select(occasions.c.code)))
    existing_rules = set(bind.scalars(sa.select(rules.c.rule_key)))
    for code, (label, role) in CATEGORIES.items():
        if code not in existing_categories:
            bind.execute(
                categories.insert().values(code=code, label=label, item_role=role, active=True)
            )
    for code, label in OCCASIONS.items():
        if code not in existing_occasions:
            bind.execute(occasions.insert().values(code=code, label=label, active=True))
    for occasion, (style, options) in RULES.items():
        slots = [
            {
                "slot_key": ROLES[option.split("/")[0]].lower(),
                "role": ROLES[option.split("/")[0]],
                "categories": option.split("/"),
                "required": True,
            }
            for option in options
        ]
        for rule_key, style_code in (
            (f"{occasion.lower()}_{style.lower()}", style),
            (f"fallback_{occasion.lower()}", None),
        ):
            if rule_key in existing_rules:
                continue
            bind.execute(
                rules.insert().values(
                    id=str(uuid4()),
                    rule_key=rule_key,
                    version=1,
                    occasion_code=occasion,
                    style_code=style_code,
                    gender=None,
                    slots=slots,
                    priority=0,
                    active=True,
                    created_at=datetime.now(UTC),
                )
            )


def downgrade():
    # Catalog products and saved looks may reference these taxonomy rows.
    pass
