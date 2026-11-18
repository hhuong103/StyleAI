from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.errors import AppError
from app.modules.stylist.virtual_tryon import VELL_MODEL_PATH, _inline_reference
from app.modules.vell.integration_repository import VellIntegrationRepository
from app.modules.vell.integration_schemas import (
    Capability,
    VellCapabilities,
    VellConfig,
    VellHealth,
)


def health(db):
    try:
        if not VellIntegrationRepository(db).schema_ready():
            raise AppError(503, "VELL_NOT_READY", "Database/migration VELL chưa sẵn sàng.")
    except SQLAlchemyError as exc:
        db.rollback()
        raise AppError(503, "VELL_NOT_READY", "Database/migration VELL chưa sẵn sàng.") from exc
    return VellHealth()


def model_ready():
    return _inline_reference(VELL_MODEL_PATH) is not None


def public_config():
    presets = ["VELL_SEO_YEON"] if model_ready() else []
    return VellConfig(
        legacy_redirects={"/shop": "/vell"},
        model_presets=presets,
        default_model_preset=presets[0] if presets else None,
        provider_model=settings.gemini_image_model,
    )


def capabilities(db):
    health(db)
    try:
        has_product, has_rules = VellIntegrationRepository(db).catalog_facts()
        model_count, has_verified_product = VellIntegrationRepository(db).domain_facts()
    except SQLAlchemyError as exc:
        db.rollback()
        raise AppError(503, "VELL_NOT_READY", "Catalog VELL chưa sẵn sàng.") from exc
    reference_ready = model_ready()
    # A configured endpoint is not proof that the provider can process images.
    from app.modules.vell.segmentation import HttpSegmentationProvider

    try:
        HttpSegmentationProvider()
        segmentation_configured = True
    except (AppError, ValueError):
        segmentation_configured = False
    ai_configured = bool(
        settings.gemini_api_key and settings.gemini_image_model and reference_ready
    )
    ai_reasons = []
    if not settings.gemini_api_key:
        ai_reasons.append("PROVIDER_KEY_MISSING")
    if not settings.gemini_image_model:
        ai_reasons.append("PROVIDER_MODEL_MISSING")
    if not reference_ready:
        ai_reasons.append("MODEL_REFERENCE_MISSING")
    # A nonempty key is not proof that the provider or queue worker is operational.
    ai_reasons.extend(["PROVIDER_NOT_VERIFIED", "WORKER_HEALTH_NOT_VERIFIED"])
    return VellCapabilities(
        model_selection=Capability(
            implemented=True,
            configured=model_count > 1,
            available=model_count > 1,
            reasons=[] if model_count > 1 else ["MULTIPLE_MODEL_ASSETS_REQUIRED"],
            modes=["versioned_presets"],
            authentication_required=False,
        ),
        recommendation=Capability(
            implemented=True,
            configured=has_rules,
            available=has_rules and has_verified_product,
            reasons=[]
            if has_rules and has_verified_product
            else [
                reason
                for flag, reason in [
                    (has_rules, "ACTIVE_RULES_MISSING"),
                    (has_verified_product, "VERIFIED_CATALOG_REQUIRED"),
                ]
                if not flag
            ],
            modes=["catalog_rule_ranking"],
            authentication_required=True,
        ),
        virtual_try_on=Capability(
            implemented=True,
            configured=ai_configured,
            available=False,
            reasons=ai_reasons,
            modes=["synchronous", "durable_jobs"],
            authentication_required=True,
        ),
        garment_segmentation=Capability(
            implemented=True,
            configured=segmentation_configured,
            available=False,
            reasons=(
                ["SEGMENTATION_PROVIDER_NOT_CONFIGURED"] if not segmentation_configured else []
            )
            + ["EXTERNAL_PROVIDER_NOT_VERIFIED", "MANUAL_MAPPING_REVIEW_REQUIRED"],
            modes=["external_http_segmentation"],
            authentication_required=True,
        ),
        shopping_links=Capability(
            implemented=True,
            configured=has_verified_product,
            available=has_verified_product,
            reasons=[
                "LIVE_LISTING_VERIFICATION_NOT_IMPLEMENTED",
                "PER_RESULT_MAPPING_REVIEW_REQUIRED",
            ]
            + ([] if has_verified_product else ["VERIFIED_CATALOG_REQUIRED"]),
            modes=["admin_attested_links", "reviewed_shopping_regions"],
            authentication_required=False,
        ),
    )
