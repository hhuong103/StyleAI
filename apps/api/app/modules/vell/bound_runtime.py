import hashlib
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.config import settings
from app.core.errors import AppError
from app.core.schemas import VirtualTryOnInput
from app.db.models import Product, TryOnJob, User, Variant, uid
from app.modules.catalog.service import safe_media_path
from app.modules.stylist.virtual_tryon import _inline_reference
from app.modules.vell.domain_models import Composition, CompositionItem, JobBinding, StudioSession
from app.modules.vell.domain_service import fingerprint, model, owned, verified_url


def submit_bound_job(db, user_id, body, key):
    request_hash = fingerprint(body.model_dump(mode="json"))
    db.execute(select(User.id).where(User.id == user_id).with_for_update())
    prior = db.scalar(
        select(TryOnJob).where(TryOnJob.user_id == user_id, TryOnJob.idempotency_key == str(key))
    )
    if prior:
        if prior.request_hash != request_hash:
            raise AppError(409, "IDEMPOTENCY_CONFLICT", "Key đã được dùng với dữ liệu khác.")
        return prior
    session = owned(db, StudioSession, body.session_id, user_id, lock=True)
    if session.version != body.session_version or not session.outfit_id:
        raise AppError(409, "INVALID_SESSION_STATE", "Session hoặc outfit đã thay đổi.")
    preset = model(db, session.model_id)
    outfit = owned(db, Composition, session.outfit_id, user_id)
    garments = list(
        db.scalars(
            select(CompositionItem)
            .where(CompositionItem.outfit_id == outfit.id)
            .order_by(CompositionItem.slot)
        )
    )
    # Current adapter accepts up to four image references, including shoes.
    # Extra garments are rejected, never silently omitted.
    if len(garments) > 4 or len(garments) < 3:
        raise AppError(
            422,
            "TRYON_MODE_UNSUPPORTED",
            "Provider hiện hỗ trợ outfit 3–4 garments; không được bỏ món.",
        )
    references = [_inline_reference(safe_media_path(preset.asset_key))]
    products, versions = [], []
    for garment in garments:
        product = db.get(Product, garment.product_id)
        variant = db.get(Variant, garment.variant_id)
        if (
            not verified_url(db, product)
            or not variant
            or not variant.active
            or not variant.available
        ):
            raise AppError(
                409, "PRODUCT_UNAVAILABLE", "Sản phẩm hoặc chứng thực URL không còn hợp lệ."
            )
        path = safe_media_path(product.images[0].storage_key)
        reference = _inline_reference(path)
        if reference is None:
            raise AppError(422, "INVALID_IMAGE", "Ảnh garment không đọc được.")
        references.append(reference)
        versions.append(
            {
                "garment_id": garment.id,
                "product_id": product.id,
                "variant_id": variant.id,
                "image_hash": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )
        products.append({"id": product.id, "name": product.name})
    cache_key = fingerprint(
        {
            "model_id": preset.id,
            "asset_version": preset.asset_version,
            "asset_hash": preset.asset_hash,
            "avatar_configuration_version": session.version,
            "outfit_id": outfit.id,
            "outfit_revision": outfit.revision,
            "garments": versions,
            "mode": body.try_on_mode,
            "provider": settings.gemini_image_model,
            "provider_version": "gemini-adapter-v2",
            "filter": session.filter_id,
            "realism": session.realism,
        }
    )
    # Reuse only this user's exact immutable binding; never use another model/job image.
    cached = db.scalar(
        select(TryOnJob)
        .join(JobBinding, JobBinding.job_id == TryOnJob.id)
        .where(
            TryOnJob.user_id == user_id,
            JobBinding.cache_key == cache_key,
            TryOnJob.status.in_(["QUEUED", "RUNNING", "SUCCEEDED"]),
        )
        .order_by(TryOnJob.created_at.desc())
        .limit(1)
    )
    if cached:
        session.active_job_id = cached.id
        return cached
    count = db.scalar(
        select(func.count())
        .select_from(TryOnJob)
        .where(
            TryOnJob.user_id == user_id,
            TryOnJob.created_at >= datetime.now(UTC) - timedelta(hours=1),
        )
    )
    if count >= 5:
        raise AppError(429, "RATE_LIMIT_EXCEEDED", "Chỉ được tạo tối đa 5 job mỗi giờ.")
    if not settings.gemini_api_key:
        raise AppError(503, "TRYON_PROVIDER_UNAVAILABLE", "Chưa cấu hình Gemini.")
    payload_body = VirtualTryOnInput(
        selected_products=[p["id"] for p in products],
        gender={"FEMALE": "FEMALE", "MALE": "MALE", "ANDROGYNOUS": "UNISEX"}[preset.presentation],
        age=23,
        height_cm=165,
        weight_kg=52,
        background="STUDIO",
        consent_external_processing=True,
        identity_reference=True,
    ).model_dump(mode="json")
    job_id = uid()
    key_path = f"vell-inputs/{user_id}/{job_id}.json"
    path = settings.media_root / key_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(references), encoding="utf-8")
    job = TryOnJob(
        id=job_id,
        user_id=user_id,
        idempotency_key=str(key),
        request_hash=request_hash,
        provider="gemini",
        status="QUEUED",
        payload={"body": payload_body, "products": products, "input_key": key_path, "bound": True},
    )
    db.add(job)
    db.flush()
    db.add(
        JobBinding(
            job_id=job.id,
            session_id=session.id,
            model_id=preset.id,
            model_asset_hash=preset.asset_hash,
            model_asset_version=preset.asset_version,
            session_version=session.version,
            outfit_id=outfit.id,
            outfit_revision=outfit.revision,
            cache_key=cache_key,
        )
    )
    session.active_job_id = job.id
    db.flush()
    return job


def read_inputs(payload):
    if not payload.get("bound"):
        return payload["references"]
    path = (settings.media_root / payload["input_key"]).resolve()
    if not path.is_relative_to(settings.media_root.resolve()) or not path.is_file():
        raise AppError(422, "TRYON_INPUT_MISSING", "Ảnh đầu vào job không tồn tại.")
    return json.loads(path.read_text(encoding="utf-8"))


def cleanup_inputs(payload):
    key = payload.get("input_key", "")
    path = (settings.media_root / key).resolve()
    if key.startswith("vell-inputs/") and path.is_relative_to(settings.media_root.resolve()):
        path.unlink(missing_ok=True)


def write_heartbeat():
    path = settings.media_root / "vell-runtime" / "worker-heartbeat.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"timestamp": datetime.now(UTC).isoformat()}), encoding="utf-8")


def complete_binding(db, job_id, output):
    binding = db.get(JobBinding, job_id)
    if binding is None:
        return output
    front_url = next(view["url"] for view in output["views"] if view["view"] == "FRONT")
    path = safe_media_path(front_url.removeprefix("/media/"))
    binding.output_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    from app.modules.vell.segmentation import HttpSegmentationProvider

    try:
        HttpSegmentationProvider()
        binding.segmentation_status = "QUEUED"
    except AppError:
        binding.segmentation_status = "NOT_CONFIGURED"
    output.update(
        {
            "model_id": binding.model_id,
            "model_asset_version": binding.model_asset_version,
            "outfit_id": binding.outfit_id,
            "outfit_revision": binding.outfit_revision,
            "avatar_configuration_version": binding.session_version,
            "result_image_hash": binding.output_hash,
            "quality_status": "MANUAL_REVIEW_REQUIRED",
            "generated_at": datetime.now(UTC).isoformat(),
        }
    )
    return output
