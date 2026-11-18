import hashlib
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.errors import AppError
from app.db.models import Category, Product, Variant
from app.modules.auth.security import utc
from app.modules.catalog.repository import (
    ProductRepository,
    canonical_shopee_product_url,
    price_of,
    product_data,
)
from app.modules.catalog.service import safe_media_path
from app.modules.stylist.virtual_tryon import _inline_reference
from app.modules.vell.domain_models import (
    Composition,
    CompositionItem,
    JobBinding,
    ModelPreset,
    ProductVerification,
    VellAudit,
)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def owned(db, cls, key, user_id, lock=False):
    row = db.scalar(
        select(cls).where(cls.id == str(key), cls.user_id == user_id).with_for_update()
        if lock
        else select(cls).where(cls.id == str(key), cls.user_id == user_id)
    )
    if row is None:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên của bạn.")
    return row


def model(db, key):
    row = db.get(ModelPreset, str(key))
    if row is None:
        raise AppError(404, "MODEL_NOT_FOUND", "Không tìm thấy người mẫu.")
    path = safe_media_path(row.asset_key)
    if (
        hashlib.sha256(path.read_bytes()).hexdigest() != row.asset_hash
        or _inline_reference(path) is None
    ):
        raise AppError(
            409, "MODEL_ASSET_CHANGED", "Ảnh người mẫu đã thay đổi; cần đăng ký version mới."
        )
    return row


def model_data(row):
    return {
        "model_id": row.id,
        "name": row.name,
        "presentation": row.presentation,
        "full_body_image_url": f"/media/{row.asset_key}",
        "portrait_url": f"/media/{row.asset_key}",
        "model_version": 1,
        "asset_version": row.asset_version,
        "asset_hash": row.asset_hash,
        "supported_try_on_modes": ["MULTI_GARMENT"],
        "customization": {"face": False, "hair": False, "body_shape": False, "tattoos": False},
        "identity_quality_verification": "MANUAL_REVIEW_REQUIRED",
    }


def create_model(db, body):
    if not body.asset_key.startswith("uploads/"):
        raise AppError(422, "MODEL_ASSET_INVALID", "Cần ảnh model đã upload.")
    path = safe_media_path(body.asset_key)
    if _inline_reference(path) is None:
        raise AppError(422, "MODEL_ASSET_INVALID", "Ảnh người mẫu không đọc được.")
    row = ModelPreset(**body.model_dump(), asset_hash=hashlib.sha256(path.read_bytes()).hexdigest())
    db.add(row)
    db.flush()
    return row


def session_data(row):
    return {
        "session_id": row.id,
        "model_id": row.model_id,
        "version": row.version,
        "outfit_id": row.outfit_id,
        "active_job_id": row.active_job_id,
        "filter_id": row.filter_id,
        "realism": row.realism,
        "realism_supported": False,
    }


def patch_session(db, row, body):
    if row.version != body.version:
        raise AppError(409, "SESSION_VERSION_CONFLICT", "Session đã thay đổi. Hãy tải lại.")
    changes = body.model_dump(exclude_unset=True, exclude={"version"})
    if any(value is None for value in changes.values()):
        raise AppError(422, "INVALID_SESSION_STATE", "Không dùng null để thay đổi session.")
    if body.model_id is not None:
        model(db, body.model_id)
        row.model_id = str(body.model_id)
    if body.outfit_id is not None:
        owned(db, Composition, body.outfit_id, row.user_id)
        row.outfit_id = str(body.outfit_id)
    for name in ("filter_id", "realism"):
        if name in changes:
            setattr(row, name, changes[name])
    # Even a setting change invalidates the active binding. Old jobs stay immutable.
    row.active_job_id = None
    row.version += 1
    return row


def product_fingerprint(product):
    def image_hash(image):
        try:
            return hashlib.sha256(safe_media_path(image.storage_key).read_bytes()).hexdigest()
        except AppError:
            return "MISSING"

    return fingerprint(
        {
            "id": product.id,
            "code": product.product_code,
            "name": product.name,
            "url": product.product_url,
            "color": product.color_code,
            "images": [(image.storage_key, image_hash(image)) for image in product.images],
            "variants": [
                (v.id, v.sku, v.size_code, v.price_override_vnd) for v in product.variants
            ],
            "price": product.base_price_vnd,
        }
    )


def verified_url(db, product):
    url = canonical_shopee_product_url(product.product_url)
    if not url or not product.active or not any(v.active and v.available for v in product.variants):
        return None
    record = db.scalar(
        select(ProductVerification)
        .where(
            ProductVerification.product_id == product.id,
            ProductVerification.product_fingerprint == product_fingerprint(product),
        )
        .order_by(ProductVerification.created_at.desc())
        .limit(1)
    )
    return url if record and utc(record.expires_at) > datetime.now(UTC) else None


def verify_product(db, product_id, body, admin_id):
    product = ProductRepository(db).get(str(product_id))
    for image in product.images:
        safe_media_path(image.storage_key)
    if canonical_shopee_product_url(product.product_url) is None:
        raise AppError(
            422, "PRODUCT_URL_UNVERIFIED", "URL phải là listing trong retailer allowlist."
        )
    # An authenticated administrator attests product/SKU/page identity with evidence.
    # HTTP 200 and URL shape alone never create this record.
    row = ProductVerification(
        product_id=product.id,
        verified_by=admin_id,
        product_fingerprint=product_fingerprint(product),
        retailer_sku=body.retailer_sku,
        evidence=body.evidence,
        expires_at=datetime.now(UTC) + timedelta(hours=body.valid_hours),
    )
    db.add(row)
    db.flush()
    audit(db, admin_id, "PRODUCT_VERIFIED", product.id, {"verification_id": row.id})
    return row


def product_view(db, product):
    data = product_data(product)
    data["product_url"] = verified_url(db, product)
    data["verification_status"] = "VERIFIED" if data["product_url"] else "UNVERIFIED"
    data["verification_method"] = "ADMIN_ATTESTATION" if data["product_url"] else None
    return data


def compose(db, user_id, body):
    source = owned(db, Composition, body.source_id, user_id) if body.source_id else None
    row = Composition(
        user_id=user_id,
        name=body.name,
        source_id=source.id if source else None,
        revision=source.revision + 1 if source else 1,
    )
    validated = []
    urls = set()
    roles = {
        "INNER_TOP": "TOP",
        "OUTERWEAR": "OUTERWEAR",
        "BOTTOM": "BOTTOM",
        "SHOES": "SHOES",
        "FULL_BODY": "FULL_BODY",
        "BAG": "ACCESSORY",
        "ACCESSORY": "ACCESSORY",
    }
    for item in body.garments:
        product = ProductRepository(db).get(str(item.product_id))
        variant = db.get(Variant, str(item.variant_id))
        category = db.get(Category, product.category_code)
        if not category or not category.active or category.item_role != roles[item.slot]:
            raise AppError(422, "OUTFIT_COMPOSITION_INVALID", "Sản phẩm không khớp garment slot.")
        if (
            not variant
            or variant.product_id != product.id
            or not variant.active
            or not variant.available
        ):
            raise AppError(409, "PRODUCT_UNAVAILABLE", "Biến thể không hợp lệ hoặc đã hết hàng.")
        url = verified_url(db, product)
        if not url:
            raise AppError(
                422, "PRODUCT_URL_UNVERIFIED", "Cần xác minh đúng sản phẩm/SKU/URL trước khi phối."
            )
        if url in urls:
            raise AppError(
                422,
                "OUTFIT_COMPOSITION_INVALID",
                "Các garment khác nhau cần listing sản phẩm riêng.",
            )
        urls.add(url)
        safe_media_path(product.images[0].storage_key)
        validated.append((item, product))
    db.add(row)
    db.flush()
    for item, product in validated:
        db.add(
            CompositionItem(
                outfit_id=row.id,
                product_id=product.id,
                variant_id=str(item.variant_id),
                slot=item.slot,
            )
        )
    db.flush()
    return row


def outfit_data(db, row):
    items = list(
        db.scalars(
            select(CompositionItem)
            .where(CompositionItem.outfit_id == row.id)
            .order_by(CompositionItem.slot)
        )
    )
    groups = {name: [] for name in ("TOPS", "BOTTOMS", "FULL BODY", "SHOES", "ACCESSORIES")}
    result = []
    total = 0
    for item in items:
        product = db.get(Product, item.product_id)
        variant = db.get(Variant, item.variant_id)
        selected_price = price_of(product, variant)
        total += selected_price
        garment = {
            "selected_variant": {
                "id": variant.id,
                "sku": variant.sku,
                "size": variant.size_code,
                "price_vnd": selected_price,
                "available": product.active and variant.active and variant.available,
            },
            "garment_id": item.id,
            "product_id": item.product_id,
            "variant_id": item.variant_id,
            "slot": item.slot,
            "product": product_view(db, product),
        }
        group = {
            "INNER_TOP": "TOPS",
            "OUTERWEAR": "TOPS",
            "BOTTOM": "BOTTOMS",
            "FULL_BODY": "FULL BODY",
            "SHOES": "SHOES",
        }.get(item.slot, "ACCESSORIES")
        groups[group].append(garment)
        result.append(garment)
    return {
        "outfit_id": row.id,
        "total_price_vnd": total,
        "currency": "VND",
        "revision": row.revision,
        "name": row.name,
        "garments": result,
        "accordion": {
            name: {"count": len(values), "items": values} for name, values in groups.items()
        },
    }


def audit(db, user_id, action, entity_id, details):
    db.add(VellAudit(user_id=user_id, action=action, entity_id=entity_id, details=details))


def bound_job(db, result_id, user_id):
    from app.db.models import TryOnJob

    job = db.get(TryOnJob, str(result_id))
    binding = db.get(JobBinding, str(result_id))
    if not job or job.user_id != user_id or not binding:
        raise AppError(404, "TRY_ON_RESULT_NOT_FOUND", "Không tìm thấy kết quả của bạn.")
    if job.status != "SUCCEEDED":
        raise AppError(409, "TRY_ON_NOT_READY", "Ảnh mặc thử chưa hoàn tất.")
    return job, binding
