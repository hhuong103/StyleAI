import asyncio
import base64
import hashlib
import os
from datetime import UTC, datetime, timedelta
from typing import Protocol
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update

from app.core.errors import AppError
from app.db.models import Product
from app.db.session import SessionLocal
from app.modules.catalog.service import safe_media_path
from app.modules.vell.domain_models import (
    CompositionItem,
    GarmentRegion,
    JobBinding,
    ProductVerification,
)
from app.modules.vell.domain_service import bound_job, product_fingerprint, verified_url


class RegionInput(BaseModel):
    garment_id: str
    product_id: str
    polygon: list[tuple[float, float]] = Field(min_length=3, max_length=1000)
    confidence: float = Field(ge=0, le=1)
    layer_priority: int = Field(default=0, ge=0, le=100)


class SegmentationOutput(BaseModel):
    result_id: str
    result_image_hash: str
    regions: list[RegionInput] = Field(max_length=100)


class SegmentationProvider(Protocol):
    async def segment(
        self, result_id: str, image_hash: str, image: bytes, garments: list[dict]
    ) -> SegmentationOutput: ...


class HttpSegmentationProvider:
    """Trusted deployment configuration only, never a client-supplied URL."""

    def __init__(self):
        self.url = os.getenv("VELL_SEGMENTATION_URL", "").strip()
        parsed = urlsplit(self.url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise AppError(
                503,
                "SEGMENTATION_PROVIDER_UNAVAILABLE",
                "Cần cấu hình segmentation HTTPS provider.",
            )
        self.token = os.getenv("VELL_SEGMENTATION_TOKEN", "")

    async def segment(self, result_id, image_hash, image, garments):
        async with httpx.AsyncClient(
            timeout=120, follow_redirects=False, trust_env=False
        ) as client:
            response = await client.post(
                self.url,
                headers={"Authorization": f"Bearer {self.token}"},
                json={
                    "result_id": result_id,
                    "result_image_hash": image_hash,
                    "image_base64": base64.b64encode(image).decode(),
                    "garments": garments,
                    "coordinate_system": "normalized_0_1",
                },
            )
            if response.status_code != 200 or len(response.content) > 2_000_000:
                raise AppError(
                    502, "SEGMENTATION_FAILED", "Segmentation provider không trả kết quả hợp lệ."
                )
            return SegmentationOutput.model_validate(response.json())


def validate_regions(output, job_id, image_hash, garments):
    if output.result_id != job_id or output.result_image_hash != image_hash:
        raise AppError(422, "REGION_MAPPING_INVALID", "Segmentation không thuộc đúng ảnh kết quả.")
    mapping = {item["garment_id"]: item["product_id"] for item in garments}
    for region in output.regions:
        if mapping.get(region.garment_id) != region.product_id:
            raise AppError(
                422, "REGION_MAPPING_INVALID", "Garment/product mapping không khớp outfit."
            )
        points = region.polygon
        if any(not 0 <= value <= 1 for point in points for value in point):
            raise AppError(422, "REGION_MAPPING_INVALID", "Tọa độ phải nằm trong [0,1].")
        area = (
            abs(
                sum(
                    x * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * y
                    for i, (x, y) in enumerate(points)
                )
            )
            / 2
        )
        rectangular = (
            len(points) == 4
            and len({x for x, _ in points}) == 2
            and len({y for _, y in points}) == 2
        )
        if area <= 0.00001 or rectangular:
            raise AppError(
                422,
                "REGION_MAPPING_INVALID",
                "Cần polygon garment thực, không dùng box hoặc vùng rỗng.",
            )


def queue_segmentation(db, result_id, user_id):
    HttpSegmentationProvider()  # Refuse immediately if no real provider is configured.
    _, binding = bound_job(db, result_id, user_id)
    if binding.segmentation_status in {"QUEUED", "RUNNING", "PENDING_REVIEW", "VERIFIED"}:
        return binding
    binding.segmentation_status = "QUEUED"
    binding.segmentation_error = None
    return binding


async def segment_once(session_factory=SessionLocal, provider_factory=HttpSegmentationProvider):
    from app.db.models import TryOnJob

    with session_factory() as db:
        db.execute(
            update(JobBinding)
            .where(
                JobBinding.segmentation_status == "RUNNING",
                JobBinding.segmentation_started_at < datetime.now(UTC) - timedelta(minutes=5),
            )
            .values(segmentation_status="FAILED")
        )
        binding = db.scalar(
            select(JobBinding)
            .where(JobBinding.segmentation_status == "QUEUED")
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if binding is None:
            db.commit()
            return False
        binding.segmentation_status = "RUNNING"
        claimed_at = datetime.now(UTC)
        binding.segmentation_started_at = claimed_at
        job_id, outfit_id, output_hash = binding.job_id, binding.outfit_id, binding.output_hash
        job = db.get(TryOnJob, job_id)
        image_url = next(v["url"] for v in job.result["views"] if v["view"] == "FRONT")
        garments = [
            {"garment_id": item.id, "product_id": item.product_id, "slot": item.slot}
            for item in db.scalars(
                select(CompositionItem).where(CompositionItem.outfit_id == outfit_id)
            )
        ]
        db.commit()
    try:
        image = safe_media_path(image_url.removeprefix("/media/")).read_bytes()
        if hashlib.sha256(image).hexdigest() != output_hash:
            raise AppError(409, "RESULT_CHANGED", "Ảnh kết quả đã thay đổi.")
        output = await asyncio.wait_for(
            provider_factory().segment(job_id, output_hash, image, garments), 150
        )
        validate_regions(output, job_id, output_hash, garments)
        with session_factory() as db:
            binding = db.scalar(
                select(JobBinding)
                .where(
                    JobBinding.job_id == job_id,
                    JobBinding.segmentation_status == "RUNNING",
                    JobBinding.segmentation_started_at == claimed_at,
                )
                .with_for_update()
            )
            if binding is None:
                return True
            db.execute(delete(GarmentRegion).where(GarmentRegion.job_id == job_id))
            for region in output.regions:
                db.add(
                    GarmentRegion(
                        job_id=job_id,
                        garment_id=region.garment_id,
                        product_id=region.product_id,
                        polygon=region.polygon,
                        confidence=str(region.confidence),
                        layer_priority=region.layer_priority,
                    )
                )
            binding.segmentation_status = "PENDING_REVIEW"
            db.commit()
    except Exception as exc:
        with session_factory() as db:
            db.execute(
                update(JobBinding)
                .where(
                    JobBinding.job_id == job_id,
                    JobBinding.segmentation_status == "RUNNING",
                    JobBinding.segmentation_started_at == claimed_at,
                )
                .values(
                    segmentation_status="FAILED",
                    segmentation_error={
                        "code": exc.code if isinstance(exc, AppError) else "SEGMENTATION_FAILED",
                        "message": "Không thể xác định garment regions hợp lệ.",
                    },
                )
            )
            db.commit()
    return True


def shopping_regions(db, result_id, user_id):
    job, binding = bound_job(db, result_id, user_id)
    image_url = next(v["url"] for v in job.result["views"] if v["view"] == "FRONT")
    if (
        hashlib.sha256(safe_media_path(image_url.removeprefix("/media/")).read_bytes()).hexdigest()
        != binding.output_hash
    ):
        raise AppError(409, "RESULT_CHANGED", "Ảnh đã thay đổi; không dùng vùng cũ.")
    if binding.quality_status != "APPROVED" or binding.segmentation_status != "VERIFIED":
        raise AppError(
            409, "SEGMENTATION_NOT_READY", "Ảnh và garment mapping chưa được kiểm chứng."
        )
    regions = list(
        db.scalars(
            select(GarmentRegion).where(
                GarmentRegion.job_id == str(result_id), GarmentRegion.status == "VERIFIED"
            )
        )
    )
    result = []
    for region in regions:
        product = db.get(Product, region.product_id)
        url = verified_url(db, product)
        if url:
            verification = db.scalar(
                select(ProductVerification)
                .where(
                    ProductVerification.product_id == product.id,
                    ProductVerification.product_fingerprint == product_fingerprint(product),
                )
                .order_by(ProductVerification.created_at.desc())
                .limit(1)
            )
            result.append(
                {
                    "valid_until": verification.expires_at.isoformat(),
                    "region_id": region.id,
                    "garment_id": region.garment_id,
                    "product_id": product.id,
                    "product_name": product.name,
                    "retailer_name": "Shopee",
                    "verified_product_url": url,
                    "polygon": region.polygon,
                    "coordinate_system": "normalized_0_1",
                    "layer_priority": region.layer_priority,
                    "purchase_availability": "AVAILABLE",
                    "verification_status": "ADMIN_ATTESTED",
                }
            )
    return {
        "result_id": str(result_id),
        "model_id": binding.model_id,
        "outfit_id": binding.outfit_id,
        "outfit_revision": binding.outfit_revision,
        "result_image_hash": binding.output_hash,
        "regions": result,
    }


async def serve():
    while True:
        try:
            worked = await segment_once()
        except Exception:
            worked = False
        if not worked:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(serve())
