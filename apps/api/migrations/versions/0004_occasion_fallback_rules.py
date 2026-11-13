"""Backfill outfit rules for occasions that have no matching style rule."""

from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

FALLBACKS = {
    "INTERVIEW": [
        "SHIRT/BLOUSE",
        "BLAZER/CARDIGAN",
        "TROUSERS/SKIRT",
        "LOAFERS/FLATS/DRESS_SHOES",
    ],
    "OFFICE": [
        "SHIRT/BLOUSE/POLO",
        "TROUSERS/WIDE_LEG_PANTS/SKIRT",
        "LOAFERS/FLATS/DRESS_SHOES",
    ],
    "CAFE": [
        "T_SHIRT/SHIRT/BLOUSE/POLO",
        "JEANS/WIDE_LEG_PANTS/SHORTS/SKIRT",
        "SNEAKERS/LOAFERS/FLATS/SANDALS",
    ],
    "DATE": ["SHIRT/BLOUSE", "TROUSERS/WIDE_LEG_PANTS/SKIRT", "LOAFERS/FLATS/SANDALS"],
    "PARTY": [
        "BLOUSE/SHIRT",
        "BLAZER/CARDIGAN",
        "TROUSERS/SKIRT",
        "LOAFERS/FLATS/DRESS_SHOES",
    ],
    "TRAVEL": [
        "T_SHIRT/POLO",
        "LIGHT_JACKET/CARDIGAN/DENIM_JACKET",
        "JEANS/JOGGERS/SHORTS",
        "SNEAKERS/SANDALS",
    ],
    "DAILY": [
        "T_SHIRT/SHIRT/BLOUSE/POLO",
        "JEANS/WIDE_LEG_PANTS/SHORTS",
        "SNEAKERS/LOAFERS/SANDALS",
    ],
}

CATEGORY_ROLES = {
    "T_SHIRT": "TOP",
    "SHIRT": "TOP",
    "BLOUSE": "TOP",
    "POLO": "TOP",
    "BLAZER": "OUTERWEAR",
    "CARDIGAN": "OUTERWEAR",
    "LIGHT_JACKET": "OUTERWEAR",
    "DENIM_JACKET": "OUTERWEAR",
    "TROUSERS": "BOTTOM",
    "SKIRT": "BOTTOM",
    "WIDE_LEG_PANTS": "BOTTOM",
    "JEANS": "BOTTOM",
    "SHORTS": "BOTTOM",
    "JOGGERS": "BOTTOM",
    "LOAFERS": "SHOES",
    "FLATS": "SHOES",
    "DRESS_SHOES": "SHOES",
    "SNEAKERS": "SHOES",
    "SANDALS": "SHOES",
}


def _slots(categories):
    slots = []
    for category_options in categories:
        category_codes = category_options.split("/")
        role = CATEGORY_ROLES[category_codes[0]]
        slots.append(
            {
                "slot_key": role.lower(),
                "role": role,
                "categories": category_codes,
                "required": True,
            }
        )
    return slots


def upgrade():
    bind = op.get_bind()
    occasions = sa.table("occasions", sa.column("code", sa.String(40)))
    existing_occasions = set(bind.scalars(sa.select(occasions.c.code)))
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
    existing_rule_keys = set(
        bind.scalars(
            sa.select(rules.c.rule_key).where(
                rules.c.rule_key.in_([f"fallback_{code.lower()}" for code in FALLBACKS])
            )
        )
    )
    created_at = datetime.now(timezone.utc)

    for occasion, categories in FALLBACKS.items():
        rule_key = f"fallback_{occasion.lower()}"
        if occasion not in existing_occasions or rule_key in existing_rule_keys:
            continue
        bind.execute(
            rules.insert().values(
                id=str(uuid4()),
                rule_key=rule_key,
                version=1,
                occasion_code=occasion,
                style_code=None,
                gender=None,
                slots=_slots(categories),
                priority=0,
                active=True,
                created_at=created_at,
            )
        )


def downgrade():
    pass
