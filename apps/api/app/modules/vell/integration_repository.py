from functools import cache
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import select, text

from app.db.models import Category, OutfitRule, Product, TryOnJob, Variant
from app.modules.catalog.repository import ProductRepository, is_shopee_product_url


@cache
def schema_head():
    api_root = Path(__file__).resolve().parents[3]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    return ScriptDirectory.from_config(config).get_current_head()


class VellIntegrationRepository:
    def __init__(self, db):
        self.db = db

    def schema_ready(self):
        revision = self.db.scalar(text("SELECT version_num FROM alembic_version"))
        # Probe columns used by both job and catalog APIs, without reading user data.
        self.db.execute(select(TryOnJob.id, TryOnJob.payload).limit(0))
        self.db.execute(select(Product.id, Product.product_url).limit(0))
        return revision == schema_head()

    def catalog_facts(self):
        candidates = self.db.scalars(
            select(Product.product_url)
            .join(Category, Product.category_code == Category.code)
            .where(
                Product.active.is_(True),
                Category.active.is_(True),
                *ProductRepository._real_product_conditions(),
                Product.variants.any(Variant.active.is_(True) & Variant.available.is_(True)),
            )
        )
        has_product = any(is_shopee_product_url(url) for url in candidates)
        has_rules = (
            self.db.scalar(select(OutfitRule.id).where(OutfitRule.active.is_(True)).limit(1))
            is not None
        )
        return has_product, has_rules

    def domain_facts(self):
        from app.core.errors import AppError
        from app.modules.vell.domain_models import ModelPreset
        from app.modules.vell.domain_service import model, verified_url

        valid_models = 0
        for row in self.db.scalars(select(ModelPreset)):
            try:
                model(self.db, row.id)
                valid_models += 1
            except AppError:
                continue
        verified_catalog = any(
            verified_url(self.db, product)
            for product in self.db.scalars(
                select(Product).where(
                    Product.active.is_(True), *ProductRepository._real_product_conditions()
                )
            )
        )
        return valid_models, verified_catalog
